import { useState, useEffect, useRef } from "react";
import { collection, query, orderBy, onSnapshot, doc, updateDoc, addDoc, serverTimestamp, deleteDoc } from "firebase/firestore";
import { db } from "../firebase";
import { toast } from "react-hot-toast";
import { cn } from "../lib/utils";
import { ShieldCheck, MessageSquare, Send, CheckCircle2, XCircle, MinusCircle, Loader2, Trash2 } from "lucide-react";
import { useNotifications } from "../context/NotificationContext";
import { format } from "date-fns";

export default function ComplaintPanel({ profile }) {
    const [complaints, setComplaints] = useState([]);
    const [selectedComplaint, setSelectedComplaint] = useState(null);
    const [panelChats, setPanelChats] = useState([]);
    const [newMsg, setNewMsg] = useState("");
    const [loadingChats, setLoadingChats] = useState(false);

    // 🔥 NEW STATE: Track which message is being confirmed for deletion 🔥
    const [confirmingChatDeleteId, setConfirmingChatDeleteId] = useState(null);

    const chatEndRef = useRef(null);
    const { sendNotification } = useNotifications();

    // Fetch all complaints
    useEffect(() => {
        const q = query(collection(db, "complaints"), orderBy("createdAt", "desc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter(c => !c.deleted);
            setComplaints(data);

            // Safely update selected complaint using functional state to avoid dependency loops
            setSelectedComplaint(prevSelected => {
                if (!prevSelected) return null;
                const updated = data.find(c => c.id === prevSelected.id);
                return updated || prevSelected;
            });
        }, (error) => {
            console.error("Error fetching complaints:", error);
            toast.error("Error loading complaints. Check permissions.");
        });

        return () => unsubscribe();
    }, []);

    // Fetch chats
    useEffect(() => {
        if (!selectedComplaint?.id) return;

        setLoadingChats(true);
        const qChat = query(
            collection(db, "complaints", selectedComplaint.id, "panelChats"),
            orderBy("createdAt", "asc")
        );

        const unsubscribeChat = onSnapshot(qChat, (snapshot) => {
            const chats = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setPanelChats(chats);
            setLoadingChats(false);
            // Auto-scroll to bottom of chat
            setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
        }, (error) => {
            console.error("Chat listener error:", error);
            setLoadingChats(false);
            toast.error("Cannot load chats. Check Firestore rules for panelChats.");
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
        } catch (error) {
            console.error("Vote error:", error);
            toast.error("Failed to cast vote");
        }
    };

    const handleSendChat = async (e) => {
        e.preventDefault();
        if (!newMsg.trim() || !selectedComplaint) return;

        const messageText = newMsg.trim();
        setNewMsg(""); // Optimistically clear input

        try {
            await addDoc(collection(db, "complaints", selectedComplaint.id, "panelChats"), {
                text: messageText,
                senderName: profile.displayName,
                senderId: profile.uid,
                createdAt: serverTimestamp()
            });
        } catch (error) {
            console.error("Chat send error:", error);
            toast.error("Failed to send message to database.");
            setNewMsg(messageText); // Restore input if failed
        }
    };

    // 🔥 Handle Chat Deletion (Clears state after delete) 🔥
    const handleDeleteChat = async (chatId) => {
        if (!selectedComplaint) return;
        try {
            await deleteDoc(doc(db, "complaints", selectedComplaint.id, "panelChats", chatId));
        } catch (error) {
            console.error("Delete chat error:", error);
            toast.error("Failed to delete message");
        } finally {
            setConfirmingChatDeleteId(null); // Reset confirmation state
        }
    };

    const handleVerify = async () => {
        if (!selectedComplaint) return;
        try {
            await updateDoc(doc(db, "complaints", selectedComplaint.id), {
                status: "verified"
            });

            await sendNotification({
                title: "Complaint Verified by Panel",
                message: `The panel has reviewed and verified a complaint. Action required.`,
                link: `/management`,
                recipients: ["role_management", "role_principal"],
                type: "INFO"
            });

            await sendNotification({
                title: "Complaint Verified",
                message: `Your complaint has been verified by the Campus Panel and forwarded to the Principal.`,
                link: `/complaints`,
                recipients: [selectedComplaint.authorUid],
                type: "COMPLAINT"
            });

            toast.success("Complaint marked as verified and escalated to Principal!");
        } catch (error) {
            console.error("Verification error:", error);
            toast.error("Failed to verify complaint");
        }
    };

    // Calculate anonymous poll results dynamically
    const votes = selectedComplaint?.panelVotes || {};
    const agreeCount = Object.values(votes).filter(v => v === "agree").length;
    const disagreeCount = Object.values(votes).filter(v => v === "disagree").length;
    const neitherCount = Object.values(votes).filter(v => v === "neither").length;

    return (
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row gap-6 h-[calc(100vh-120px)]">
            {/* Left List: Complaint Inbox */}
            <div className="w-full lg:w-1/3 bg-white border border-zinc-200 rounded-3xl overflow-hidden flex flex-col shadow-sm">
                <div className="p-6 bg-zinc-900 text-white shrink-0">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <ShieldCheck className="text-indigo-400" /> Panel Inbox
                    </h2>
                    <p className="text-xs text-zinc-400 mt-1">Select a complaint to review</p>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                    {complaints.length === 0 ? (
                        <p className="text-center text-sm text-zinc-500 py-8">No complaints available.</p>
                    ) : (
                        complaints.map(c => (
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
                                        c.status === "pending" ? "bg-amber-100 text-amber-700 border-amber-200" :
                                            c.status === "verified" ? "bg-indigo-100 text-indigo-700 border-indigo-200" :
                                                c.status === "in-progress" ? "bg-blue-100 text-blue-700 border-blue-200" :
                                                    c.status === "resolved" ? "bg-emerald-100 text-emerald-700 border-emerald-200" :
                                                        "bg-red-100 text-red-700 border-red-200"
                                    )}>{c.status}</span>
                                    <span className="text-[10px] text-zinc-400">
                                        {c.createdAt?.toDate ? format(c.createdAt.toDate(), "MMM d") : ""}
                                    </span>
                                </div>
                                <p className="text-sm font-bold text-zinc-900 line-clamp-2">{c.text}</p>
                            </button>
                        ))
                    )}
                </div>
            </div>

            {/* Right Dashboard: Active Review */}
            <div className="flex-1 bg-white border border-zinc-200 rounded-3xl overflow-hidden flex flex-col shadow-sm">
                {selectedComplaint ? (
                    <>
                        {/* Complaint Header & Actions */}
                        <div className="p-6 border-b border-zinc-100 bg-zinc-50 shrink-0">
                            <h3 className="font-bold text-zinc-900 mb-2">Complaint Details</h3>
                            <p className="text-sm text-zinc-700 bg-white p-4 rounded-xl border border-zinc-200 mb-4">
                                {selectedComplaint.text}
                            </p>

                            {/* Poll & Final Action */}
                            <div className="flex flex-wrap items-center justify-between gap-4">
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

                                <button
                                    onClick={handleVerify}
                                    disabled={selectedComplaint.status !== "pending"}
                                    className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all disabled:opacity-50 shadow-lg shadow-indigo-600/20"
                                >
                                    {selectedComplaint.status === "pending" ? "Verify & Escalate" : "Already Escalated"}
                                </button>
                            </div>
                        </div>

                        {/* Internal Panel Chat Stream */}
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

                                                {/* 🔥 INLINE CONFIRMATION FOR DELETION 🔥 */}
                                                {isMe && (
                                                    confirmingChatDeleteId === chat.id ? (
                                                        <div className="flex items-center gap-1 animate-in fade-in zoom-in duration-200">
                                                            <button
                                                                onClick={() => handleDeleteChat(chat.id)}
                                                                className="px-1.5 py-0.5 bg-red-600 text-white text-[8px] font-bold rounded hover:bg-red-700 transition-colors"
                                                            >
                                                                Confirm
                                                            </button>
                                                            <button
                                                                onClick={() => setConfirmingChatDeleteId(null)}
                                                                className="px-1.5 py-0.5 bg-zinc-200 text-zinc-600 text-[8px] font-bold rounded hover:bg-zinc-300 transition-colors"
                                                            >
                                                                No
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <button
                                                            onClick={() => setConfirmingChatDeleteId(chat.id)}
                                                            className="text-red-400 hover:text-red-600 transition-colors"
                                                            title="Delete message"
                                                        >
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

                        {/* Chat Input */}
                        <form onSubmit={handleSendChat} className="p-4 bg-white border-t border-zinc-100 flex gap-2 shrink-0">
                            <input
                                type="text"
                                value={newMsg}
                                onChange={(e) => setNewMsg(e.target.value)}
                                placeholder="Discuss this complaint with the panel..."
                                className="flex-1 px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm transition-all"
                            />
                            <button
                                type="submit"
                                disabled={!newMsg.trim()}
                                className="px-5 py-3 bg-zinc-900 text-white rounded-xl hover:bg-zinc-800 transition-all disabled:opacity-50 shadow-lg shadow-zinc-900/20 flex items-center justify-center"
                            >
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