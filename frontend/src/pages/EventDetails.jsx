import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { 
  doc, 
  getDoc, 
  collection, 
  addDoc, 
  query, 
  where, 
  getDocs, 
  updateDoc, 
  increment,
  onSnapshot,
  deleteDoc
} from "firebase/firestore";
import { db } from "../firebase";
import { toast } from "react-hot-toast";
import { motion, AnimatePresence } from "motion/react";
import { 
  Calendar, 
  MapPin, 
  Clock, 
  Users, 
  CheckCircle2, 
  Loader2, 
  ArrowLeft,
  ScanLine,
  XCircle,
  QrCode,
  MessageSquare,
  Trash2,
  Share2
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { format } from "date-fns";
import QRScanner from "../components/QRScanner";
import { QRCodeSVG } from "qrcode.react";
import { cn } from "../lib/utils";

export default function EventDetails({ profile }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [registration, setRegistration] = useState(null);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [feedback, setFeedback] = useState([]);
  const [feedbackText, setFeedbackText] = useState("");
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [attendees, setAttendees] = useState([]);

  useEffect(() => {
    if (!id || !profile) return;

    const unsubscribe = onSnapshot(doc(db, "events", id), 
      (docSnap) => {
        if (docSnap.exists()) {
          setEvent({ id: docSnap.id, ...docSnap.data() });
        } else {
          toast.error("Event not found");
          navigate("/");
        }
        setLoading(false);
      },
      (error) => {
        console.error("Event listener error:", error);
        setLoading(false);
      }
    );

    const fetchFeedback = async () => {
      try {
        const fbSnap = await getDocs(collection(db, "events", id, "feedback"));
        setFeedback(fbSnap.docs.map(doc => doc.data()));
      } catch (error) {
        console.error("Feedback fetch error:", error);
      }
    };

    fetchFeedback();

    const q = query(
      collection(db, "registrations"),
      where("eventId", "==", id),
      where("studentId", "==", profile.uid)
    );

    const unsubscribeReg = onSnapshot(q, 
      (snapshot) => {
        if (!snapshot.empty) {
          setRegistration({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() });
        } else {
          setRegistration(null);
        }
      },
      (error) => {
        console.error("Registration listener error:", error);
      }
    );

    // Fetch all attendees
    const qAttendees = query(
      collection(db, "registrations"),
      where("eventId", "==", id)
    );
    
    const unsubscribeAttendees = onSnapshot(qAttendees, 
      (snapshot) => {
        const attendeesList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Sort: Attended first, then by name
        attendeesList.sort((a, b) => {
          if (a.attended === b.attended) {
            return a.studentName.localeCompare(b.studentName);
          }
          return a.attended ? -1 : 1;
        });
        setAttendees(attendeesList);
      },
      (error) => {
        console.error("Attendees listener error:", error);
      }
    );

    return () => {
      unsubscribe();
      unsubscribeReg();
      unsubscribeAttendees();
    };
  }, [id, profile, navigate]);

  const handleDeleteEvent = async () => {
    try {
      await deleteDoc(doc(db, "events", id));
      toast.success("Event deleted successfully");
      navigate("/");
    } catch (error) {
      console.error("Error deleting event:", error);
      toast.error("Failed to delete event");
    }
  };

  const handleRegister = async () => {
    if (!id || !profile || !event) return;

    if (event.allowedDepartments && !event.allowedDepartments.includes("ALL") && !event.allowedDepartments.includes(profile.department)) {
      toast.error("You are not eligible to register for this event.");
      return;
    }

    const capacity = parseInt(event.capacity, 10);
    const registeredCount = parseInt(event.registeredCount || 0, 10);

    if (capacity && registeredCount >= capacity) {
      toast.error("Sorry, this event is already full!");
      return;
    }

    setRegistering(true);
    try {
      const requiresApproval = event.requiresApproval || false;
      const status = requiresApproval ? "pending" : "approved";
      
      let qrCodeData = null;
      if (status === "approved") {
        qrCodeData = btoa(JSON.stringify({
          eventId: id,
          studentId: profile.uid,
          timestamp: Date.now()
        }));
      }

      const regData = {
        eventId: id,
        studentId: profile.uid,
        studentName: profile.displayName,
        studentEmail: profile.email,
        qrCodeData,
        attended: false,
        status: status,
        registeredAt: Date.now(),
      };

      if (profile.studentId) {
        regData.collegeStudentId = profile.studentId;
      }

      const docRef = await addDoc(collection(db, "registrations"), regData);

      if (status === "approved") {
        await updateDoc(doc(db, "events", id), {
          registeredCount: increment(1)
        });
        toast.success("Successfully registered for the event!");
      } else {
        toast.success("Registration submitted! Waiting for host approval.");
      }
      
      setRegistration({ id: docRef.id, ...regData });
    } catch (error) {
      console.error("Registration failed:", error);
      toast.error("Failed to register: " + error.message);
    } finally {
      setRegistering(false);
    }
  };

  const handleApproveRegistration = async (regId, studentId) => {
    try {
      const qrCodeData = btoa(JSON.stringify({
        eventId: id,
        studentId: studentId,
        timestamp: Date.now()
      }));

      await updateDoc(doc(db, "registrations", regId), {
        status: "approved",
        qrCodeData: qrCodeData
      });

      await updateDoc(doc(db, "events", id), {
        registeredCount: increment(1)
      });
      
      toast.success("Registration approved!");
    } catch (error) {
      console.error("Error approving:", error);
      toast.error("Failed to approve");
    }
  };

  const handleRejectRegistration = async (regId) => {
    try {
      await updateDoc(doc(db, "registrations", regId), {
        status: "rejected"
      });
      toast.success("Registration rejected");
    } catch (error) {
      console.error("Error rejecting:", error);
      toast.error("Failed to reject");
    }
  };

  const handleScan = async (data) => {
    try {
      console.log("Scanned data:", data);
      let decoded;
      try {
        decoded = JSON.parse(atob(data));
      } catch (e) {
        console.error("Failed to decode QR data:", e);
        toast.error("Invalid QR code format");
        return;
      }

      console.log("Decoded data:", decoded);
      
      if (decoded.eventId !== id) {
        toast.error("Invalid QR code for this event");
        return;
      }

      const q = query(
        collection(db, "registrations"),
        where("eventId", "==", id),
        where("studentId", "==", decoded.studentId)
      );
      
      const querySnapshot = await getDocs(q);
      if (querySnapshot.empty) {
        toast.error("Registration not found");
        return;
      }

      const regDoc = querySnapshot.docs[0];
      const regData = regDoc.data();

      if (regData.attended) {
        toast.error(`${regData.studentName} is already marked as attended`);
        return;
      }

      await updateDoc(doc(db, "registrations", regDoc.id), {
        attended: true
      });

      toast.success(`Attendance marked for ${regData.studentName}!`);
    } catch (error) {
      console.error("Scan error:", error);
      toast.error("Error processing scan: " + error.message);
    }
  };

  const handleEndEvent = async () => {
    try {
      await updateDoc(doc(db, "events", id), { status: "completed" });
      toast.success("Event ended successfully");
    } catch (error) {
      toast.error("Failed to end event");
    }
  };

  const handleSubmitFeedback = async () => {
    if (!feedbackText) return;
    setSubmittingFeedback(true);
    try {
      await addDoc(collection(db, "events", id, "feedback"), {
        studentId: profile.uid,
        studentName: profile.displayName,
        text: feedbackText,
        createdAt: Date.now()
      });
      setFeedbackText("");
      toast.success("Feedback submitted!");
      const fbSnap = await getDocs(collection(db, "events", id, "feedback"));
      setFeedback(fbSnap.docs.map(doc => doc.data()));
    } catch (error) {
      toast.error("Failed to submit feedback");
    } finally {
      setSubmittingFeedback(false);
    }
  };

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: event.title,
          text: `Check out ${event.title} happening on ${format(new Date(event.date), "PPP")}!`,
          url: window.location.href,
        });
      } else {
        await navigator.clipboard.writeText(window.location.href);
        toast.success("Link copied to clipboard!");
      }
    } catch (error) {
      console.error("Error sharing:", error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="animate-spin text-zinc-900" size={32} />
          <p className="text-zinc-500 font-medium animate-pulse">Loading event details...</p>
        </div>
      </div>
    );
  }

  if (!event) return null;

  const isHost = profile?.uid === event.hostId;
  const isStudent = profile?.role?.toLowerCase() === 'student';

  return (
    <div className="max-w-7xl mx-auto">
      <button
        onClick={() => navigate(-1)}
        className="mb-8 flex items-center gap-2 text-zinc-500 hover:text-zinc-900 transition-colors font-medium group"
      >
        <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
        Back to Events
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        <div className="lg:col-span-8 space-y-8">
          <div className="aspect-video rounded-[2rem] overflow-hidden border border-zinc-200 shadow-2xl shadow-zinc-900/10 bg-zinc-100 relative group">
            <img
              src={event.posterUrl}
              alt={event.title}
              referrerPolicy="no-referrer"
              className="w-full h-full object-contain transition-transform duration-700 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>

          <div className="bg-white border border-zinc-200 rounded-[2rem] p-8 md:p-10 shadow-sm">
            <div className="flex items-start justify-between gap-4 mb-8">
              <h1 className="text-4xl md:text-5xl font-serif font-bold text-zinc-900 leading-tight">{event.title}</h1>
              <button 
                onClick={handleShare}
                className="p-3 rounded-full bg-zinc-50 text-zinc-600 hover:bg-zinc-100 transition-colors border border-zinc-100 shadow-sm shrink-0"
                title="Share Event"
              >
                <Share2 size={20} />
              </button>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
              <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                <div className="flex items-center gap-2 text-zinc-400 text-xs font-bold uppercase tracking-wider mb-1">
                  <Calendar size={14} /> Date
                </div>
                <div className="text-zinc-900 font-bold">{format(new Date(event.date), "MMM d, yyyy")}</div>
              </div>
              <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                <div className="flex items-center gap-2 text-zinc-400 text-xs font-bold uppercase tracking-wider mb-1">
                  <Clock size={14} /> Time
                </div>
                <div className="text-zinc-900 font-bold">{event.time}</div>
              </div>
              <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                <div className="flex items-center gap-2 text-zinc-400 text-xs font-bold uppercase tracking-wider mb-1">
                  <MapPin size={14} /> Location
                </div>
                <div className="text-zinc-900 font-bold truncate" title={event.location}>{event.location}</div>
              </div>
              <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                <div className="flex items-center gap-2 text-zinc-400 text-xs font-bold uppercase tracking-wider mb-1">
                  <Users size={14} /> Capacity
                </div>
                <div className="text-zinc-900 font-bold">
                  {event.registeredCount} {event.capacity ? `/ ${event.capacity}` : ""}
                </div>
              </div>
            </div>

            <div className="prose prose-zinc max-w-none prose-headings:font-serif prose-headings:font-bold prose-a:text-emerald-600 hover:prose-a:text-emerald-500 prose-img:rounded-2xl">
              <ReactMarkdown>{event.description}</ReactMarkdown>
            </div>
            
            {event.allowedDepartments && !event.allowedDepartments.includes("ALL") && (
              <div className="mt-8 pt-8 border-t border-zinc-100">
                <h4 className="text-sm font-bold text-zinc-900 mb-3 uppercase tracking-wider">Restricted Access</h4>
                <div className="flex flex-wrap gap-2">
                  {event.allowedDepartments.map(dept => (
                    <span key={dept} className="px-3 py-1 bg-zinc-100 text-zinc-600 text-xs font-bold rounded-lg border border-zinc-200">
                      {dept} Only
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Attendees Section */}
          <div className="bg-white border border-zinc-200 rounded-[2rem] p-8 md:p-10 shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-2xl font-bold text-zinc-900 flex items-center gap-3">
                <Users size={24} className="text-zinc-400" />
                Guest List
              </h3>
              <span className="bg-zinc-100 text-zinc-600 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border border-zinc-200">
                {attendees.length} Registered
              </span>
            </div>
            
            {attendees.length === 0 ? (
              <div className="text-center py-12 bg-zinc-50 rounded-2xl border border-zinc-100 border-dashed">
                <Users className="mx-auto text-zinc-300 mb-3" size={32} />
                <p className="text-zinc-500 font-medium">Be the first to register!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {attendees.map((attendee, index) => (
                  <div key={index} className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-zinc-100 hover:border-zinc-300 hover:shadow-md transition-all group">
                    <div className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold shrink-0 transition-colors shadow-sm",
                      attendee.attended ? "bg-emerald-100 text-emerald-700" : 
                      attendee.status === "pending" ? "bg-amber-100 text-amber-700" :
                      attendee.status === "rejected" ? "bg-red-100 text-red-700" :
                      "bg-zinc-100 text-zinc-500"
                    )}>
                      {attendee.studentName.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-base font-bold text-zinc-900 truncate uppercase">{attendee.studentName}</div>
                      <div className="text-xs text-zinc-500 truncate flex flex-wrap items-center gap-1.5 mt-0.5">
                        <span className="font-medium bg-zinc-50 px-1.5 py-0.5 rounded border border-zinc-100">
                          {attendee.collegeStudentId || "Student"}
                        </span>
                        {attendee.attended && (
                          <span className="text-emerald-600 flex items-center gap-1 font-bold">
                            <CheckCircle2 size={12} /> Attended
                          </span>
                        )}
                        {attendee.status === "pending" && (
                          <span className="text-amber-600 flex items-center gap-1 font-bold">
                            <Clock size={12} /> Pending
                          </span>
                        )}
                        {attendee.status === "rejected" && (
                          <span className="text-red-600 flex items-center gap-1 font-bold">
                            <XCircle size={12} /> Rejected
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {isHost && attendee.status === "pending" && (
                      <div className="flex gap-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => handleApproveRegistration(attendee.id, attendee.studentId)}
                          className="p-2 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 transition-colors border border-emerald-100"
                          title="Approve"
                        >
                          <CheckCircle2 size={18} />
                        </button>
                        <button 
                          onClick={() => handleRejectRegistration(attendee.id)}
                          className="p-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors border border-red-100"
                          title="Reject"
                        >
                          <XCircle size={18} />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-4 space-y-6">
          <div className="sticky top-24 space-y-6">
            <div className="bg-white border border-zinc-200 rounded-[2rem] p-8 shadow-xl shadow-zinc-900/5">
              <h3 className="text-xl font-bold text-zinc-900 mb-6">Action Center</h3>
              
              {isHost ? (
                <div className="space-y-4">
                  <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl text-emerald-800 text-sm font-bold flex items-center gap-3">
                    <div className="bg-white p-1.5 rounded-lg shadow-sm">
                      <CheckCircle2 size={16} className="text-emerald-600" />
                    </div>
                    You are hosting this event
                  </div>
                  
                  {event.status === "completed" ? (
                    <div className="space-y-4">
                      <h4 className="font-bold text-zinc-900 flex items-center gap-2">
                        <MessageSquare size={18} className="text-zinc-400" />
                        Feedback Received
                      </h4>
                      {feedback.length === 0 ? (
                        <p className="text-sm text-zinc-500 italic">No feedback submitted yet.</p>
                      ) : (
                        <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                          {feedback.map((fb, i) => (
                            <div key={i} className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100 text-sm">
                              <p className="font-bold text-zinc-900 mb-1">{fb.studentName}</p>
                              <p className="text-zinc-600 leading-relaxed">{fb.text}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                  <>
                    <button
                      onClick={() => setShowScanner(!showScanner)}
                      className={cn(
                        "w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg",
                        showScanner 
                          ? "bg-red-50 text-red-600 border border-red-100 hover:bg-red-100" 
                          : "bg-zinc-900 text-white hover:bg-zinc-800 shadow-zinc-900/20"
                      )}
                    >
                      {showScanner ? (
                        <>
                          <XCircle size={20} />
                          Close Scanner
                        </>
                      ) : (
                        <>
                          <ScanLine size={20} />
                          Scan Attendance
                        </>
                      )}
                    </button>

                    {(event.status === "pending" || event.status === "approved") && (
                      showEndConfirm ? (
                        <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl space-y-3">
                          <p className="text-amber-800 text-sm font-medium text-center">Are you sure you want to end this event? This action cannot be undone.</p>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setShowEndConfirm(false)}
                              className="flex-1 py-2 rounded-xl font-bold text-zinc-600 bg-white border border-zinc-200 hover:bg-zinc-50 transition-all"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={handleEndEvent}
                              className="flex-1 py-2 rounded-xl font-bold text-white bg-amber-600 hover:bg-amber-700 transition-all"
                            >
                              Yes, End Event
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setShowEndConfirm(true)}
                          className="w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all bg-white text-zinc-900 border border-zinc-200 hover:bg-zinc-50"
                        >
                          <CheckCircle2 size={20} />
                          End Event
                        </button>
                      )
                    )}

                    <AnimatePresence>
                      {showScanner && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="pt-4">
                            <QRScanner onScan={handleScan} />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </>
                )}

                {showDeleteConfirm ? (
                  <div className="p-4 bg-red-50 border border-red-100 rounded-2xl space-y-3">
                    <p className="text-red-800 text-sm font-medium text-center">Are you sure you want to delete this event?</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowDeleteConfirm(false)}
                        className="flex-1 py-2 rounded-xl font-bold text-zinc-600 bg-white border border-zinc-200 hover:bg-zinc-50 transition-all"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleDeleteEvent}
                        className="flex-1 py-2 rounded-xl font-bold text-white bg-red-600 hover:bg-red-700 transition-all"
                      >
                        Yes, Delete
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all bg-white text-red-600 border border-red-200 hover:bg-red-50"
                  >
                    <Trash2 size={20} />
                    Delete Event
                  </button>
                )}
              </div>
            ) : registration ? (
              registration.status === "rejected" ? (
                <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-red-700 text-sm font-bold flex items-center gap-3">
                  <div className="bg-white p-1.5 rounded-lg shadow-sm">
                    <XCircle size={16} className="text-red-600" />
                  </div>
                  Registration Rejected
                </div>
              ) : registration.status === "pending" ? (
                <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl text-amber-700 text-sm font-bold flex items-center gap-3">
                  <div className="bg-white p-1.5 rounded-lg shadow-sm">
                    <Clock size={16} className="text-amber-600" />
                  </div>
                  Registration Pending Approval
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl text-emerald-700 text-sm font-bold flex items-center gap-3">
                    <div className="bg-white p-1.5 rounded-lg shadow-sm">
                      <CheckCircle2 size={16} className="text-emerald-600" />
                    </div>
                    You are registered!
                  </div>
                  
                  {event.status === "completed" ? (
                    <div className="space-y-4">
                      <h4 className="font-bold text-zinc-900 flex items-center gap-2">
                        <MessageSquare size={18} className="text-zinc-400" />
                        Share Your Feedback
                      </h4>
                      <textarea 
                        value={feedbackText} 
                        onChange={(e) => setFeedbackText(e.target.value)}
                        className="w-full p-4 rounded-2xl border border-zinc-200 focus:ring-2 focus:ring-zinc-900 focus:border-transparent outline-none transition-all resize-none h-32"
                        placeholder="How was the event? Share your thoughts..."
                      />
                      <button 
                        onClick={handleSubmitFeedback}
                        disabled={submittingFeedback || !feedbackText.trim()}
                        className="w-full py-3 rounded-xl bg-zinc-900 text-white font-bold hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-zinc-900/20"
                      >
                        {submittingFeedback ? (
                          <span className="flex items-center justify-center gap-2">
                            <Loader2 className="animate-spin" size={18} /> Submitting...
                          </span>
                        ) : "Submit Feedback"}
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-col items-center p-8 bg-zinc-900 rounded-[2rem] shadow-xl shadow-zinc-900/20 relative overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 to-zinc-900" />
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 via-blue-500 to-purple-600" />
                        
                        <div className="relative bg-white p-4 rounded-2xl shadow-lg mb-6 group-hover:scale-105 transition-transform duration-500">
                          <QRCodeSVG value={registration.qrCodeData} size={180} />
                        </div>
                        <p className="relative text-xs font-bold text-zinc-400 uppercase tracking-widest text-center mb-1">
                          Entry Pass
                        </p>
                        <p className="relative text-zinc-500 text-xs text-center">
                          Show this QR code at the venue
                        </p>
                      </div>

                      {registration.attended && (
                        <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl text-blue-700 text-sm font-bold flex items-center justify-center gap-2">
                          <CheckCircle2 size={18} />
                          Attendance Marked
                        </div>
                      )}
                    </>
                  )}
                </div>
              )
            ) : isStudent ? (
              <div className="space-y-4">
                {event.capacity && event.registeredCount >= event.capacity && (
                  <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-red-700 text-sm font-bold flex items-center gap-3">
                    <div className="bg-white p-1.5 rounded-lg shadow-sm">
                      <XCircle size={16} className="text-red-600" />
                    </div>
                    This event is fully booked
                  </div>
                )}
                <button
                  onClick={handleRegister}
                  disabled={registering || (!!event.capacity && event.registeredCount >= event.capacity)}
                  className="w-full bg-zinc-900 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-zinc-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-zinc-900/20 hover:shadow-2xl hover:-translate-y-0.5"
                >
                  {registering ? (
                    <Loader2 className="animate-spin" size={20} />
                  ) : (
                    <>
                      <QrCode size={20} />
                      {!!event.capacity && event.registeredCount >= event.capacity ? "Join Waitlist" : "Register Now"}
                    </>
                  )}
                </button>
                <p className="text-xs text-center text-zinc-400">
                  By registering, you agree to the event guidelines.
                </p>
              </div>
            ) : (
              <div className="p-4 bg-zinc-50 border border-zinc-100 rounded-2xl text-zinc-500 text-sm font-medium text-center">
                Registration is only open for students.
              </div>
            )}

            <div className="mt-8 pt-8 border-t border-zinc-100">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-zinc-100 to-zinc-200 flex items-center justify-center text-zinc-500 font-bold text-lg shadow-inner">
                  {event.hostName.charAt(0)}
                </div>
                <div>
                  <div className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-0.5">Hosted by</div>
                  <div className="text-base font-bold text-zinc-900 uppercase">{event.hostName}</div>
                  {event.hostStudentId && <div className="text-xs text-zinc-500">{event.hostStudentId}</div>}
                </div>
              </div>
            </div>
          </div>

          </div>
        </div>
      </div>
    </div>
  );
}
