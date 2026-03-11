import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { Calendar, MapPin, Clock, AlertCircle, CheckCircle2, XCircle, Plus, Loader2, ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { cn } from "../lib/utils";

export default function MyEvents({ profile }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;

    const q = query(
      collection(db, "events"),
      where("hostId", "==", profile.uid)
    );

    const unsubscribe = onSnapshot(q, 
      (querySnapshot) => {
        const eventsData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        // SAFE SORTING: Added || 0 so missing dates don't break the sort
        eventsData.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        
        setEvents(eventsData);
        setLoading(false);
      },
      (error) => {
        console.error("Events listener error:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [profile]);

  // --- HELPER FOR SAFE DATE FORMATTING ---
  const safeFormatDate = (dateValue, formatStr = "MMM d, yyyy") => {
    try {
      if (!dateValue) return "Date Pending";
      const dateObj = new Date(dateValue);
      if (isNaN(dateObj.getTime())) return "Invalid Date";
      return format(dateObj, formatStr);
    } catch (e) {
      return "Date Error";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="animate-spin text-zinc-900" size={32} />
          <p className="text-zinc-500 font-medium animate-pulse">Loading your events...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-12">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-8 border-b border-zinc-100">
        <div>
          <h1 className="text-4xl md:text-5xl font-serif font-bold text-zinc-900 mb-4">My Events</h1>
          <p className="text-zinc-500 text-lg max-w-2xl">
            Manage and track the status of all the events you have submitted.
          </p>
        </div>
        <Link 
          to="/create-event" 
          className="px-6 py-3 bg-zinc-900 text-white rounded-xl font-bold hover:bg-zinc-800 transition-all shadow-lg shadow-zinc-900/20 flex items-center gap-2 shrink-0 group"
        >
          <Plus size={20} className="group-hover:rotate-90 transition-transform" />
          Create New Event
        </Link>
      </header>

      {events.length === 0 ? (
        <div className="bg-zinc-50 border border-zinc-200 rounded-[2rem] p-16 text-center shadow-sm flex flex-col items-center justify-center min-h-[400px]">
          <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-sm mb-6">
            <Calendar className="text-zinc-300" size={40} />
          </div>
          <h3 className="text-2xl font-bold text-zinc-900 mb-3">No events created yet</h3>
          <p className="text-zinc-500 max-w-md mx-auto mb-8">
            You haven't hosted any events. Start by creating your first event to engage with the community.
          </p>
          <Link 
            to="/create-event" 
            className="px-8 py-4 bg-zinc-900 text-white rounded-2xl font-bold hover:bg-zinc-800 transition-all shadow-xl shadow-zinc-900/20 hover:shadow-2xl hover:-translate-y-1 flex items-center gap-2"
          >
            <Plus size={20} />
            Create Your First Event
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          <AnimatePresence mode="popLayout">
            {events.map((event, index) => (
              <motion.div
                key={event.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="group bg-white border border-zinc-200 rounded-[2rem] overflow-hidden shadow-sm hover:shadow-xl hover:border-zinc-300 transition-all duration-300"
              >
                <Link to={`/event/${event.id}`} className="flex flex-col md:flex-row gap-6 p-6 md:p-8">
                  <div className="w-full md:w-48 aspect-video md:aspect-[4/3] rounded-2xl overflow-hidden bg-zinc-100 shrink-0 relative shadow-inner">
                    <img 
                      src={event.posterUrl} 
                      alt={event.title} 
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
                      referrerPolicy="no-referrer" 
                    />
                    <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors" />
                  </div>
                  
                  <div className="flex-1 min-w-0 flex flex-col justify-between gap-4">
                    <div>
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <h3 className="text-2xl font-bold text-zinc-900 truncate group-hover:text-emerald-600 transition-colors">{event.title}</h3>
                        <div className={cn(
                          "px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 border shrink-0",
                          event.status === "approved" ? "bg-emerald-50 text-emerald-700 border-emerald-100" :
                          event.status === "rejected" ? "bg-red-50 text-red-700 border-red-100" :
                          event.status === "completed" ? "bg-blue-50 text-blue-700 border-blue-100" :
                          "bg-amber-50 text-amber-700 border-amber-100"
                        )}>
                          {event.status === "approved" ? <CheckCircle2 size={14} /> :
                           event.status === "rejected" ? <XCircle size={14} /> :
                           event.status === "completed" ? <CheckCircle2 size={14} /> :
                           <Clock size={14} />}
                          {event.status}
                        </div>
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-zinc-500 font-medium mb-4">
                        <div className="flex items-center gap-2">
                          <Calendar size={16} className="text-zinc-400" /> 
                          {/* SAFE DATE IMPLEMENTED HERE */}
                          {safeFormatDate(event.date)}
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock size={16} className="text-zinc-400" /> 
                          {event.time || "TBA"}
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin size={16} className="text-zinc-400" /> 
                          {event.location || "TBA"}
                        </div>
                      </div>

                      {event.status === "rejected" && event.rejectionReason && (
                        <div className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl border border-red-100 flex items-start gap-3">
                          <AlertCircle size={18} className="shrink-0 mt-0.5" />
                          <span><span className="font-bold">Rejection Reason:</span> {event.rejectionReason}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-zinc-100">
                      <div className="text-sm font-bold text-zinc-400 uppercase tracking-wider">
                        {event.registeredCount || 0} {event.capacity ? `/ ${event.capacity}` : ""} Registered
                      </div>
                      <span className="flex items-center gap-2 text-sm font-bold text-zinc-900 group-hover:translate-x-1 transition-transform">
                        View Details <ArrowRight size={16} />
                      </span>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}