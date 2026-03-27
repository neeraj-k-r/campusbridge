import { useState, useEffect } from "react";
import { collection, query, where, onSnapshot, updateDoc, doc, deleteDoc } from "firebase/firestore";
import { db } from "../firebase";
import { toast } from "react-hot-toast";
import { motion, AnimatePresence } from "motion/react";
import { CheckCircle2, XCircle, Clock, Users, Search, BookOpen, Loader2, UserCheck, Calendar, Eye, Send } from "lucide-react";
import { useNotifications } from "../context/NotificationContext";
import { cn } from "../lib/utils";
import { Navigate, Link } from "react-router-dom";

// 🔥 Set to 24 Hours 🔥
const STAGE_TIMEOUT = 24 * 60 * 60 * 1000;

const getEffectiveStage = (event) => {
    if (event.status !== "pending") return event.status;
    const now = Date.now();
    const timeSpent = now - (event.stageUpdatedAt || event.createdAt);

    if (event.approvalStage === "tutor") {
        if (timeSpent > STAGE_TIMEOUT * 2) return "principal"; // 48 hours passed -> Principal
        if (timeSpent > STAGE_TIMEOUT) return "hod"; // 24 hours passed -> Auto-forward to HOD
        return "tutor";
    }
    return event.approvalStage;
};

export default function TutorSection({ profile }) {
    const [students, setStudents] = useState([]);
    const [pendingEvents, setPendingEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [activeTab, setActiveTab] = useState("pending");
    const [processingId, setProcessingId] = useState(null);

    // Event Rejection State
    const [rejectModalOpen, setRejectModalOpen] = useState(false);
    const [selectedEventId, setSelectedEventId] = useState(null);
    const [rejectionReason, setRejectionReason] = useState("");

    const { sendNotification } = useNotifications();

    // Security Redirect: Kick out non-tutors
    if (profile && !profile.isTutor) {
        return <Navigate to="/dashboard" replace />;
    }

    useEffect(() => {
        if (!profile || !profile.isTutor) return;

        // 1. Fetch Students
        const qStudents = query(
            collection(db, "users"),
            where("role", "==", "student"),
            where("department", "==", profile.department),
            where("yearOfJoin", "==", profile.tutorOf)
        );

        const unsubscribeStudents = onSnapshot(qStudents, (snapshot) => {
            const studentData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setStudents(studentData);
            setLoading(false);
        });

        // 2. Fetch Pending Events hosted by students in this batch
        const qEvents = query(
            collection(db, "events"),
            where("status", "==", "pending"),
            where("hostDepartment", "==", profile.department),
            where("hostBatch", "==", profile.tutorOf)
        );

        const unsubscribeEvents = onSnapshot(qEvents, (snapshot) => {
            const eventData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setPendingEvents(eventData);
        });

        return () => {
            unsubscribeStudents();
            unsubscribeEvents();
        };
    }, [profile]);

    const pendingStudents = students.filter(s => s.isApproved === false);
    const approvedStudents = students.filter(s => s.isApproved === true);

    // Only show events that are actually at the Tutor stage
    const activeTutorEvents = pendingEvents.filter(e => getEffectiveStage(e) === "tutor");

    const filteredApproved = approvedStudents.filter(s =>
        s.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.rollNo?.includes(searchQuery) ||
        s.studentId?.toLowerCase().includes(searchQuery.toLowerCase())
    ).sort((a, b) => (parseInt(a.rollNo) || 0) - (parseInt(b.rollNo) || 0));

    const handleApproveStudent = async (student) => {
        setProcessingId(student.id);
        try {
            await updateDoc(doc(db, "users", student.id), { isApproved: true });
            if (sendNotification) {
                await sendNotification({
                    title: "Account Approved!",
                    message: `Your account has been approved by your Class Tutor. Welcome!`,
                    link: "/dashboard",
                    recipients: [student.id],
                    type: "SYSTEM"
                });
            }
            toast.success(`${student.displayName} approved successfully!`);
        } catch (error) {
            toast.error("Failed to approve student. Check permissions.");
        } finally {
            setProcessingId(null);
        }
    };

    const handleRejectStudent = async (student) => {
        setProcessingId(student.id);
        try {
            await deleteDoc(doc(db, "users", student.id));
            if (student.studentId) {
                await deleteDoc(doc(db, "studentIds", student.studentId));
            }
            toast.success("Student request rejected and data cleared.");
        } catch (error) {
            toast.error("Failed to reject student. Check permissions.");
        } finally {
            setProcessingId(null);
        }
    };

    // --- EVENT APPROVAL LOGIC (ONLY ONE DECLARATION) ---
    const handleApproveEvent = async (event) => {
        setProcessingId(event.id);
        try {
            // Forward to HOD
            await updateDoc(doc(db, "events", event.id), {
                approvalStage: "hod",
                stageUpdatedAt: Date.now() // Reset the 24 hour clock for the HOD
            });

            // Notify the Host that it moved up the chain
            await sendNotification({
                title: "Event Forwarded to HOD",
                message: `Your event "${event.title}" was approved by your Tutor and sent to the HOD.`,
                link: `/my-events`,
                recipients: [event.hostId], // ONLY the creator
                type: "EVENT"
            });

            // Notify the Management
            await sendNotification({
                title: "New Event Approval Request",
                message: `An event requires HOD approval.`,
                link: `/management`,
                recipients: ["role_management"], // Sent to management, NOT the whole department
                type: "EVENT"
            });

            toast.success("Event approved and forwarded to HOD!");
        } catch (error) {
            toast.error("Failed to approve event.");
        } finally {
            setProcessingId(null);
        }
    };

    const handleRejectEvent = async () => {
        if (!selectedEventId || !rejectionReason.trim()) {
            toast.error("Please provide a reason for rejection.");
            return;
        }

        setProcessingId(selectedEventId);
        try {
            const event = pendingEvents.find(e => e.id === selectedEventId);
            await updateDoc(doc(db, "events", selectedEventId), {
                status: "rejected",
                rejectionReason: rejectionReason.trim(),
                rejectedByRole: `Tutor (${profile.tutorOf} Batch)`
            });

            if (event && event.hostId) {
                await sendNotification({
                    title: "Event Rejected",
                    message: `Your event "${event.title}" was rejected by your Tutor. Reason: ${rejectionReason.trim()}`,
                    link: `/my-events`,
                    recipients: [event.hostId],
                    type: "EVENT"
                });
            }

            toast.success("Event rejected successfully!");
            setRejectModalOpen(false);
            setRejectionReason("");
            setSelectedEventId(null);
        } catch (error) {
            toast.error("Failed to reject event.");
        } finally {
            setProcessingId(null);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="animate-spin text-emerald-600" size={32} />
                    <p className="text-zinc-500 font-medium animate-pulse">Loading class data...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto space-y-8 pb-12">
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-8 border-b border-zinc-100">
                <div>
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-600 text-xs font-bold uppercase tracking-wider mb-4 border border-emerald-100">
                        <BookOpen size={14} />
                        <span>Tutor Dashboard</span>
                    </div>
                    <h1 className="text-3xl md:text-4xl font-serif font-bold text-zinc-900 mb-2">My Class Section</h1>
                    <p className="text-zinc-500 text-lg">
                        Managing <strong className="text-zinc-700">{profile.department}</strong> Batch of <strong className="text-zinc-700">{profile.tutorOf}</strong>
                    </p>
                </div>

                <div className="flex gap-4">
                    <div className="bg-white px-5 py-4 rounded-2xl border border-zinc-200 text-center min-w-[100px] shadow-sm">
                        <div className="text-2xl font-bold text-zinc-900 mb-1">{students.length}</div>
                        <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Total Students</div>
                    </div>
                    <div className="bg-amber-50 px-5 py-4 rounded-2xl border border-amber-100 text-center min-w-[100px]">
                        <div className="text-2xl font-bold text-amber-600 mb-1">{pendingStudents.length}</div>
                        <div className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">Students Pending</div>
                    </div>
                    <div className="bg-purple-50 px-5 py-4 rounded-2xl border border-purple-100 text-center min-w-[100px]">
                        <div className="text-2xl font-bold text-purple-600 mb-1">{activeTutorEvents.length}</div>
                        <div className="text-[10px] font-bold text-purple-500 uppercase tracking-wider">Events Pending</div>
                    </div>
                </div>
            </header>

            {/* Custom Tabs */}
            <div className="flex gap-4 border-b border-zinc-200 overflow-x-auto no-scrollbar">
                <button
                    onClick={() => setActiveTab("pending")}
                    className={cn(
                        "pb-4 px-2 font-bold text-sm transition-all relative flex items-center gap-2 whitespace-nowrap",
                        activeTab === "pending" ? "text-emerald-600" : "text-zinc-500 hover:text-zinc-700"
                    )}
                >
                    <Clock size={18} />
                    Student Approvals
                    {pendingStudents.length > 0 && (
                        <span className="bg-amber-500 text-white text-[10px] px-2 py-0.5 rounded-full">{pendingStudents.length}</span>
                    )}
                    {activeTab === "pending" && (
                        <motion.div layoutId="tutor-tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-600 rounded-t-full" />
                    )}
                </button>
                <button
                    onClick={() => setActiveTab("approved")}
                    className={cn(
                        "pb-4 px-2 font-bold text-sm transition-all relative flex items-center gap-2 whitespace-nowrap",
                        activeTab === "approved" ? "text-emerald-600" : "text-zinc-500 hover:text-zinc-700"
                    )}
                >
                    <Users size={18} />
                    My Class List
                    {activeTab === "approved" && (
                        <motion.div layoutId="tutor-tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-600 rounded-t-full" />
                    )}
                </button>
                <button
                    onClick={() => setActiveTab("events")}
                    className={cn(
                        "pb-4 px-2 font-bold text-sm transition-all relative flex items-center gap-2 whitespace-nowrap",
                        activeTab === "events" ? "text-purple-600" : "text-zinc-500 hover:text-zinc-700"
                    )}
                >
                    <Calendar size={18} />
                    Event Requests
                    {activeTutorEvents.length > 0 && (
                        <span className="bg-purple-500 text-white text-[10px] px-2 py-0.5 rounded-full">{activeTutorEvents.length}</span>
                    )}
                    {activeTab === "events" && (
                        <motion.div layoutId="tutor-tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600 rounded-t-full" />
                    )}
                </button>
            </div>

            <div className="pt-4">
                <AnimatePresence mode="wait">

                    {/* PENDING STUDENTS TAB */}
                    {activeTab === "pending" && (
                        <motion.div
                            key="pending"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="space-y-4"
                        >
                            {pendingStudents.length === 0 ? (
                                <div className="text-center py-16 bg-zinc-50 border border-zinc-100 rounded-3xl">
                                    <div className="w-16 h-16 bg-white text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm border border-emerald-100">
                                        <UserCheck size={32} />
                                    </div>
                                    <h3 className="text-lg font-bold text-zinc-900 mb-1">All Caught Up!</h3>
                                    <p className="text-zinc-500">There are no pending student approvals for your class.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                    {pendingStudents.map(student => (
                                        <div key={student.id} className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm flex flex-col sm:flex-row gap-4 justify-between group">
                                            <div className="flex items-start gap-4">
                                                <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center font-bold text-xl shrink-0">
                                                    {student.displayName?.[0] || "S"}
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-zinc-900 text-lg">{student.displayName}</h4>
                                                    <p className="text-sm text-zinc-500 mb-1">{student.email}</p>
                                                    <div className="flex gap-2">
                                                        <span className="text-[10px] font-bold px-2 py-0.5 bg-zinc-100 text-zinc-600 rounded uppercase tracking-wider">
                                                            Roll No: {student.rollNo || "N/A"}
                                                        </span>
                                                        <span className="text-[10px] font-bold px-2 py-0.5 bg-zinc-100 text-zinc-600 rounded uppercase tracking-wider">
                                                            ID: {student.studentId || "N/A"}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex sm:flex-col justify-end gap-2 shrink-0">
                                                <button
                                                    onClick={() => handleApproveStudent(student)}
                                                    disabled={!!processingId}
                                                    className="flex-1 sm:flex-none px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-md shadow-emerald-600/20"
                                                >
                                                    {processingId === student.id ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
                                                    Approve
                                                </button>
                                                <button
                                                    onClick={() => handleRejectStudent(student)}
                                                    disabled={!!processingId}
                                                    className="flex-1 sm:flex-none px-4 py-2 bg-red-50 text-red-600 rounded-xl font-bold text-sm hover:bg-red-100 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                                >
                                                    <XCircle size={16} />
                                                    Reject
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </motion.div>
                    )}

                    {/* APPROVED CLASS LIST TAB */}
                    {activeTab === "approved" && (
                        <motion.div
                            key="approved"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="space-y-6"
                        >
                            <div className="relative max-w-md">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={20} />
                                <input
                                    type="text"
                                    placeholder="Search by name, roll no, or ID..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-12 pr-4 py-3 bg-white border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 shadow-sm"
                                />
                            </div>

                            <div className="bg-white border border-zinc-200 rounded-3xl overflow-hidden shadow-sm">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-zinc-50 border-b border-zinc-200">
                                                <th className="p-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Roll No</th>
                                                <th className="p-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Student Details</th>
                                                <th className="p-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Student ID</th>
                                                <th className="p-4 text-xs font-bold text-zinc-500 uppercase tracking-wider text-right">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-zinc-100">
                                            {filteredApproved.length > 0 ? (
                                                filteredApproved.map(student => (
                                                    <tr key={student.id} className="hover:bg-zinc-50/50 transition-colors">
                                                        <td className="p-4">
                                                            <span className="w-8 h-8 rounded-lg bg-zinc-100 text-zinc-600 font-bold flex items-center justify-center text-sm">
                                                                {student.rollNo || "-"}
                                                            </span>
                                                        </td>
                                                        <td className="p-4">
                                                            <div className="flex items-center gap-3">
                                                                {student.photoURL ? (
                                                                    <img src={student.photoURL} alt="" className="w-10 h-10 rounded-full object-cover border border-zinc-200" />
                                                                ) : (
                                                                    <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold">
                                                                        {student.displayName?.[0]}
                                                                    </div>
                                                                )}
                                                                <div>
                                                                    <p className="font-bold text-zinc-900">{student.displayName}</p>
                                                                    <p className="text-xs text-zinc-500">{student.email}</p>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="p-4">
                                                            <span className="font-mono text-sm text-zinc-600 bg-zinc-100 px-2 py-1 rounded">
                                                                {student.studentId}
                                                            </span>
                                                        </td>
                                                        <td className="p-4 text-right">
                                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-bold uppercase tracking-wider border border-emerald-100">
                                                                <CheckCircle2 size={12} /> Approved
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan={4} className="p-8 text-center text-zinc-500">
                                                        No students found matching your search.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* EVENT REQUESTS TAB */}
                    {activeTab === "events" && (
                        <motion.div
                            key="events"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="space-y-4"
                        >
                            {activeTutorEvents.length === 0 ? (
                                <div className="text-center py-16 bg-zinc-50 border border-zinc-100 rounded-3xl">
                                    <div className="w-16 h-16 bg-white text-purple-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm border border-purple-100">
                                        <CheckCircle2 size={32} />
                                    </div>
                                    <h3 className="text-lg font-bold text-zinc-900 mb-1">All Caught Up!</h3>
                                    <p className="text-zinc-500">No events pending your approval. Events automatically forward to HOD after 24 hours.</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {activeTutorEvents.map((event) => {
                                        const timeLeft = Math.max(0, STAGE_TIMEOUT - (Date.now() - (event.stageUpdatedAt || event.createdAt)));
                                        const hoursLeft = Math.floor(timeLeft / (1000 * 60 * 60));
                                        const minutesLeft = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));

                                        return (
                                            <div key={event.id} className="bg-white border border-zinc-200 rounded-3xl overflow-hidden shadow-sm flex flex-col md:flex-row group">
                                                <div className="w-full md:w-48 h-48 md:h-auto relative overflow-hidden bg-zinc-100">
                                                    <img src={event.posterUrl} alt={event.title} className="w-full h-full object-cover" />
                                                </div>
                                                <div className="flex-1 p-4 md:p-6 flex flex-col">
                                                    <div className="flex items-start justify-between mb-4">
                                                        <div>
                                                            <div className="flex items-center gap-2 mb-2">
                                                                <span className="px-2 py-1 bg-purple-50 text-purple-700 text-[10px] font-bold uppercase tracking-wider rounded-md border border-purple-100">
                                                                    Tutor Stage
                                                                </span>
                                                                <span className="text-[10px] font-bold text-amber-500 flex items-center gap-1">
                                                                    <Clock size={12} /> Auto-forwards in {hoursLeft}h {minutesLeft}m
                                                                </span>
                                                            </div>
                                                            <h3 className="text-xl font-bold text-zinc-900 mb-1">{event.title}</h3>
                                                            <p className="text-sm text-zinc-500">Hosted by: <strong className="text-zinc-700">{event.hostName}</strong></p>
                                                        </div>
                                                    </div>

                                                    <div className="mt-auto pt-6 border-t border-zinc-100 flex flex-wrap gap-3">
                                                        <Link to={`/event/${event.id}`} className="px-4 py-2 rounded-xl bg-zinc-50 text-zinc-600 text-sm font-bold hover:bg-zinc-100 transition-all flex items-center gap-2">
                                                            <Eye size={16} /> Details
                                                        </Link>
                                                        <div className="flex-1" />
                                                        <button
                                                            onClick={() => {
                                                                setSelectedEventId(event.id);
                                                                setRejectModalOpen(true);
                                                            }}
                                                            disabled={!!processingId}
                                                            className="px-4 py-2 rounded-xl bg-red-50 text-red-600 text-sm font-bold hover:bg-red-100 transition-all flex items-center gap-2"
                                                        >
                                                            <XCircle size={16} /> Reject
                                                        </button>
                                                        <button
                                                            onClick={() => handleApproveEvent(event)}
                                                            disabled={!!processingId}
                                                            className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 transition-all flex items-center gap-2 shadow-lg shadow-emerald-600/20"
                                                        >
                                                            {processingId === event.id ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
                                                            Approve & Forward to HOD
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </motion.div>
                    )}

                </AnimatePresence>
            </div>

            {/* EVENT REJECT MODAL */}
            <AnimatePresence>
                {rejectModalOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl"
                        >
                            <h3 className="text-2xl font-bold text-zinc-900 mb-4">Reject Event</h3>
                            <p className="text-zinc-500 mb-6">Provide a reason for rejection. The event will be cancelled and sent back to the student.</p>

                            <textarea
                                value={rejectionReason}
                                onChange={(e) => setRejectionReason(e.target.value)}
                                placeholder="Reason for rejection..."
                                className="w-full p-4 bg-zinc-50 border border-zinc-200 rounded-xl mb-6 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all min-h-[120px]"
                                autoFocus
                            />

                            <div className="flex gap-3">
                                <button
                                    onClick={() => {
                                        setRejectModalOpen(false);
                                        setRejectionReason("");
                                        setSelectedEventId(null);
                                    }}
                                    className="flex-1 py-3 rounded-xl font-bold text-zinc-600 bg-zinc-100 hover:bg-zinc-200 transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleRejectEvent}
                                    disabled={!rejectionReason.trim() || !!processingId}
                                    className="flex-1 py-3 rounded-xl font-bold text-white bg-red-600 hover:bg-red-700 transition-all disabled:opacity-50"
                                >
                                    Confirm Rejection
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}