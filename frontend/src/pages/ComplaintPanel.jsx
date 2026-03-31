import { useState, useEffect, useRef } from "react";
import { collection, query, orderBy, onSnapshot, doc, updateDoc, addDoc, serverTimestamp, deleteDoc } from "firebase/firestore";
import { db } from "../firebase";
import { toast } from "react-hot-toast";
import { cn } from "../lib/utils";
import { ShieldCheck, MessageSquare, Send, CheckCircle2, XCircle, MinusCircle, Loader2, Trash2, Clock, AlertCircle } from "lucide-react";
import { useNotifications } from "../context/NotificationContext";
import { format } from "date-fns";

const COMPLAINT_TIMEOUT = 24 * 60 * 60 * 1000; // 24 hours

export default function ComplaintPanel({ profile }) {
    const [complaints, setComplaints] = useState([]);
    const [selectedComplaint, setSelectedComplaint] = useState(null);
    const [panelChats, setPanelChats] = useState([]);
    const [newMsg, setNewMsg] = useState("");
    const [loadingChats, setLoadingChats] = useState(false);
    const [confirmingChatDeleteId, setConfirmingChatDeleteId] = useState(null);
    const [now, setNow] = useState(Date.now()); // For live countdowns

    const chatEndRef = useRef(null);
    const { sendNotification } = useNotifications();

    const isPanelHead = profile?.isPanelHead;

    // Live timer tick
    useEffect(() => {
        const interval = setInterval(() => setNow(Date.now()), 60000); // Update every minute
        return () => clearInterval(interval);
    }, []);

    // Fetch all complaints
    useEffect(() => {
        const q = query(collection(db, "complaints"), orderBy("createdAt", "desc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter(c => !c.deleted);
            setComplaints(data);

            setSelectedComplaint(prevSelected => {
                if (!prevSelected) return null;
                const updated = data.find(c => c.id === prevSelected.id);
                return updated || prevSelected;
            });
        });
        return () => unsubscribe();
    }, []);

    // Fetch chats
    useEffect(() => {
        if (!selectedComplaint?.id) return;
        setLoadingChats(true);
        const qChat = query(collection(db, "complaints", selectedComplaint.id, "panelChats"), orderBy("createdAt", "asc"));
        const unsubscribeChat = onSnapshot(qChat, (snapshot) => {
            setPanelChats(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            setLoadingChats(false);
            setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
        });
        return () => unsubscribeChat();
    }, [selectedComplaint?.id]);

    const handleVote = async (voteType) => {
        if (!selectedComplaint) return;
        try {
            const complaintRef = doc(db, "complaints", selectedComplaint.id);
            await updateDoc(complaintRef, {
                [`panelVotes.${profile.uid}`]: voteType
            });
            toast.success(`Voted: ${voteType}`);
        } catch (error) { toast.error("Failed to cast vote"); }
    };

    const handleSendChat = async (e) => {
        e.preventDefault();
        if (!newMsg.trim() || !selectedComplaint) return;
        const messageText = newMsg.trim();
        setNewMsg("");
        try {
            await addDoc(collection(db, "complaints", selectedComplaint.id, "panelChats"), {
                text: messageText, senderName: profile.displayName, senderId: profile.uid, createdAt: serverTimestamp()
            });
        } catch (error) { toast.error("Failed to send message"); setNewMsg(messageText); }
    };

    const handleDeleteChat = async (chatId) => {
        if (!selectedComplaint) return;
        try {
            await deleteDoc(doc(db, "complaints", selectedComplaint.id, "panelChats", chatId));
        } catch (error) { toast.error("Failed to delete message"); }
        finally { setConfirmingChatDeleteId(null); }
    };

    // 🔥 ACTION FOR PANEL HEAD 🔥
    const handleVerifyAndEscalate = async () => {
        if (!selectedComplaint) return;
        try {
            await updateDoc(doc(db, "complaints", selectedComplaint.id), { status: "verified" });
            await sendNotification({ title: "Complaint Verified", message: `The panel has verified a complaint. Action required.`, link: `/management`, recipients: ["role_management", "role_principal"], type: "INFO" });
            await sendNotification({ title: "Complaint Escalatd", message: `Your complaint has been verified and escalated to the Principal.`, link: `/complaints`, recipients: [selectedComplaint.authorUid], type: "COMPLAINT" });
            toast.success("Complaint verified and escalated!");
        } catch (error) { toast.error("Failed to escalate complaint"); }
    };

    const handleRejectComplaint = async () => {
        if (!selectedComplaint) return;
        try {
            await updateDoc(doc(db, "complaints", selectedComplaint.id), { status: "rejected", rejectionReason: "Rejected by Panel Head via vote majority." });
            await sendNotification({ title: "Complaint Rejected", message: `Your complaint was reviewed and rejected by the Campus Panel.`, link: `/complaints`, recipients: [selectedComplaint.authorUid], type: "COMPLAINT" });
            toast.success("Complaint has been rejected.");
        } catch (error) { toast.error("Failed to reject complaint"); }
    };

    // Math Logic for UI
    const votes = selectedComplaint?.panelVotes || {};
    const agreeCount = Object.values(votes).filter(v => v === "agree").length;
    const disagreeCount = Object.values(votes).filter(v => v === "disagree").length;
    const neitherCount = Object.values(votes).filter(v => v === "neither").length;
    const totalVotes = agreeCount + disagreeCount + neitherCount;

    // Rule 1: Escalation allowed if Agree >= Disagree AND Agree >= Neither AND there is at least 1 vote
    const canEscalate = agreeCount >= disagreeCount && agreeCount >= neitherCount && totalVotes > 0;

    // Rule 2: Rejection allowed if Disagree > Agree AND totalVotes > 0
    const canReject = disagreeCount > agreeCount && totalVotes > 0;

    // Auto-Escalation Math
    const timeElapsed = selectedComplaint ? now - (selectedComplaint.createdAt?.toMillis?.() || now) : 0;
    const timeLeft = Math.max(0, COMPLAINT_TIMEOUT - timeElapsed);
    const hoursLeft = Math.floor(timeLeft / (1000 * 60 * 60));
    const minutesLeft = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
    const isAutoEscalated = selectedComplaint?.status === "pending" && timeElapsed > COMPLAINT_TIMEOUT;

    return (
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row gap-6 h-[calc(100vh-120px)]">
            {/* Left List: Complaint Inbox */}
            <div className="w-full lg:w-1/3 bg-white border border-zinc-200 rounded-3xl overflow-hidden flex flex-col shadow-sm">
                <div className="p-6 bg-zinc-900 text-white shrink-0">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <ShieldCheck className="text-indigo-400" /> Panel Inbox
                    </h2>
                    <div className="flex items-center gap-2 mt-2">
                        <p className="text-xs text-zinc-400">Select a complaint to review</p>
                        {isPanelHead && <span className="px-2 py-0.5 bg-yellow-500 text-zinc-900 text-[10px] font-bold rounded uppercase tracking-wider">Panel Head</span>}
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                    {complaints.length === 0 ? (
                        <p className="text-center text-sm text-zinc-500 py-8">No complaints available.</p>
                    ) : (
                        complaints.map(c => {
                            const cTimeElapsed = now - (c.createdAt?.toMillis?.() || now);
                            const cIsAutoEscalated = c.status === "pending" && cTimeElapsed > COMPLAINT_TIMEOUT;

                            return (
                                <button
                                    key={c.id}
                                    onClick={() => setSelectedComplaint(c)}
                                    className={cn(
                                        "w-full text-left p-4 rounded-2xl border transition-all",
                                        selectedComplaint?.id === c.id ? "bg-indigo-50 border-indigo-200" : "bg-zinc-50 border-zinc-100 hover:border-zinc-300"
                                    )}
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <span className={cn(
                                            "text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md border",
                                            cIsAutoEscalated ? "bg-red-100 text-red-700 border-red-200" :
                                                c.status === "pending" ? "bg-amber-100 text-amber-700 border-amber-200" :
                                                    c.status === "verified" ? "bg-indigo-100 text-indigo-700 border-indigo-200" :
                                                        c.status === "in-progress" ? "bg-blue-100 text-blue-700 border-blue-200" :
                                                            c.status === "resolved" ? "bg-emerald-100 text-emerald-700 border-emerald-200" :
                                                                "bg-zinc-100 text-zinc-700 border-zinc-200"
                                        )}>
                                            {cIsAutoEscalated ? "Auto-Escalated" : c.status}
                                        </span>
                                        <span className="text-[10px] text-zinc-400">
                                            {c.createdAt?.toDate ? format(c.createdAt.toDate(), "MMM d") : ""}
                                        </span>
                                    </div>
                                    <p className="text-sm font-bold text-zinc-900 line-clamp-2">{c.text}</p>
                                </button>
                            )
                        })
                    )}
                </div>
            </div>

            {/* Right Dashboard: Active Review */}
            <div className="flex-1 bg-white border border-zinc-200 rounded-3xl overflow-hidden flex flex-col shadow-sm">
                {selectedComplaint ? (
                    <>
                        <div className="p-6 border-b border-zinc-100 bg-zinc-50 shrink-0">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="font-bold text-zinc-900">Complaint Details</h3>

                                {/* 🔥 Auto-Escalation Timer Display 🔥 */}
                                {selectedComplaint.status === "pending" && !isAutoEscalated && (
                                    <span className="text-amber-600 bg-amber-50 border border-amber-100 px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1">
                                        <Clock size={12} /> Auto-escalates in {hoursLeft}h {minutesLeft}m
                                    </span>
                                )}
                                {isAutoEscalated && (
                                    <span className="text-red-600 bg-red-50 border border-red-100 px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1">
                                        <AlertCircle size={12} /> Time Expired (Sent to Principal)
                                    </span>
                                )}
                            </div>

                            <p className="text-sm text-zinc-700 bg-white p-4 rounded-xl border border-zinc-200 mb-4">
                                {selectedComplaint.text}
                            </p>

                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div className="flex flex-wrap items-center gap-2">
                                    <button onClick={() => handleVote("agree")} className={cn("px-3 py-1.5 rounded-lg text-xs font-bold border transition-all flex items-center gap-1", votes[profile.uid] === "agree" ? "bg-emerald-100 text-emerald-700 border-emerald-200 shadow-sm" : "bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50")}>
                                        <CheckCircle2 size={14} /> Agree ({agreeCount})
                                    </button>
                                    <button onClick={() => handleVote("disagree")} className={cn("px-3 py-1.5 rounded-lg text-xs font-bold border transition-all flex items-center gap-1", votes[profile.uid] === "disagree" ? "bg-red-100 text-red-700 border-red-200 shadow-sm" : "bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50")}>
                                        <XCircle size={14} /> Disagree ({disagreeCount})
                                    </button>
                                    <button onClick={() => handleVote("neither")} className={cn("px-3 py-1.5 rounded-lg text-xs font-bold border transition-all flex items-center gap-1", votes[profile.uid] === "neither" ? "bg-amber-100 text-amber-700 border-amber-200 shadow-sm" : "bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50")}>
                                        <MinusCircle size={14} /> Neither ({neitherCount})
                                    </button>
                                </div>

                                {/* 🔥 PANEL HEAD ACTIONS 🔥 */}
                                <div className="flex items-center justify-end">
                                    {isPanelHead ? (
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={handleRejectComplaint}
                                                disabled={!canReject || selectedComplaint.status !== "pending" || isAutoEscalated}
                                                className="px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-xl text-xs font-bold hover:bg-red-100 transition-all disabled:opacity-50"
                                            >
                                                Reject
                                            </button>
                                            <button
                                                onClick={handleVerifyAndEscalate}
                                                disabled={!canEscalate || selectedComplaint.status !== "pending" || isAutoEscalated}
                                                className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all disabled:opacity-50 shadow-lg shadow-indigo-600/20"
                                            >
                                                Verify & Escalate
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 bg-white px-3 py-2 border border-zinc-200 rounded-xl">
                                            Waiting on Head Decision
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-zinc-50/50 custom-scrollbar">
                            <div className="text-center mb-6">
                                <span className="bg-indigo-100 text-indigo-700 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest border border-indigo-200">
                                    Internal Panel Discussion
                                </span>
                            </div>

                            {loadingChats ? (
                                <div className="flex justify-center py-4">
                                    <Loader2 className="animate-spin text-indigo-500" size={24} />
                                </div>
                            ) : panelChats.length === 0 ? (
                                <p className="text-center text-xs text-zinc-400 mt-4">No internal discussion yet. Start the conversation!</p>
                            ) : (
                                panelChats.map((chat) => {
                                    const isMe = chat.senderId === profile.uid;
                                    return (
                                        <div key={chat.id} className={cn("flex flex-col max-w-[85%] group", isMe ? "ml-auto items-end" : "mr-auto items-start")}>
                                            <div className="flex items-center gap-2 mb-1 ml-1">
                                                <span className="text-[10px] text-zinc-400 font-bold">{chat.senderName}</span>
                                                {isMe && (
                                                    confirmingChatDeleteId === chat.id ? (
                                                        <div className="flex items-center gap-1 animate-in fade-in zoom-in duration-200">
                                                            <button onClick={() => handleDeleteChat(chat.id)} className="px-1.5 py-0.5 bg-red-600 text-white text-[8px] font-bold rounded hover:bg-red-700">Confirm</button>
                                                            <button onClick={() => setConfirmingChatDeleteId(null)} className="px-1.5 py-0.5 bg-zinc-200 text-zinc-600 text-[8px] font-bold rounded hover:bg-zinc-300">No</button>
                                                        </div>
                                                    ) : (
                                                        <button onClick={() => setConfirmingChatDeleteId(chat.id)} className="text-red-400 hover:text-red-600" title="Delete message">
                                                            <Trash2 size={12} />
                                                        </button>
                                                    )
                                                )}
                                            </div>
                                            <div className={cn("px-4 py-2.5 rounded-2xl text-sm shadow-sm", isMe ? "bg-indigo-600 text-white rounded-tr-sm" : "bg-white border border-zinc-200 text-zinc-800 rounded-tl-sm")}>
                                                {chat.text}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                            <div ref={chatEndRef} />
                        </div>

                        <form onSubmit={handleSendChat} className="p-4 bg-white border-t border-zinc-100 flex gap-2 shrink-0">
                            <input
                                type="text"
                                value={newMsg}
                                onChange={(e) => setNewMsg(e.target.value)}
                                placeholder="Discuss this complaint with the panel..."
                                className="flex-1 px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm transition-all"
                            />
                            <button type="submit" disabled={!newMsg.trim()} className="px-5 py-3 bg-zinc-900 text-white rounded-xl hover:bg-zinc-800 transition-all disabled:opacity-50 shadow-lg shadow-zinc-900/20 flex items-center justify-center">
                                <Send size={18} />
                            </button>
                        </form>
                    </>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-zinc-400 p-8 text-center">
                        <MessageSquare size={48} className="mb-4 opacity-20" />
                        <p className="font-medium text-zinc-500">Select a complaint from the inbox</p>
                        <p className="text-sm mt-2">You can review details, vote, and chat internally before making a decision.</p>
                    </div>
                )}
            </div>
        </div>
    );
}