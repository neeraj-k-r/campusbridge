import { useEffect, useState } from "react";
import { collection, query, where, getDocs, onSnapshot, documentId } from "firebase/firestore";
import { db } from "../firebase";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { Ticket, Calendar, MapPin, ArrowRight, CheckCircle2, Clock, QrCode, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { QRCodeSVG } from "qrcode.react";
import { cn } from "../lib/utils";

export default function MyRegistrations({ profile }) {
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;

    const q = query(
      collection(db, "registrations"),
      where("studentId", "==", profile.uid)
    );

    const unsubscribe = onSnapshot(q, 
      async (querySnapshot) => {
        const regs = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        if (regs.length === 0) {
          setRegistrations([]);
          setLoading(false);
          return;
        }

        // Fetch event details
        const eventIds = [...new Set(regs.map(r => r.eventId))];
        const eventsMap = {};
        
        try {
          // Fetch events in parallel
          const eventPromises = eventIds.map(id => getDocs(query(collection(db, "events"), where(documentId(), "==", id))));
          const eventSnapshots = await Promise.all(eventPromises);
          
          eventSnapshots.forEach(snap => {
            if (!snap.empty) {
              const doc = snap.docs[0];
              eventsMap[doc.id] = { id: doc.id, ...doc.data() };
            }
          });

          const regsWithEvents = regs.map(reg => ({
            ...reg,
            event: eventsMap[reg.eventId]
          })).filter(r => r.event); // Filter out registrations for deleted events

          regsWithEvents.sort((a, b) => b.registeredAt - a.registeredAt);
          setRegistrations(regsWithEvents);
        } catch (error) {
          console.error("Error fetching events for registrations:", error);
        } finally {
          setLoading(false);
        }
      },
      (error) => {
        console.error("Registrations listener error:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [profile]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="animate-spin text-zinc-900" size={32} />
          <p className="text-zinc-500 font-medium animate-pulse">Loading your tickets...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-12">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-8 border-b border-zinc-100">
        <div>
          <h1 className="text-4xl md:text-5xl font-serif font-bold text-zinc-900 mb-4">My Tickets</h1>
          <p className="text-zinc-500 text-lg max-w-2xl">
            Access your entry passes and manage your upcoming event registrations.
          </p>
        </div>
      </header>

      {registrations.length === 0 ? (
        <div className="bg-zinc-50 border border-zinc-200 rounded-[2rem] p-16 text-center shadow-sm flex flex-col items-center justify-center min-h-[400px]">
          <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-sm mb-6">
            <Ticket className="text-zinc-300" size={48} />
          </div>
          <h3 className="text-2xl font-bold text-zinc-900 mb-3">No tickets found</h3>
          <p className="text-zinc-500 max-w-md mx-auto mb-8">
            You haven't registered for any events yet. Explore the dashboard to find exciting events happening on campus!
          </p>
          <Link
            to="/"
            className="px-8 py-4 bg-zinc-900 text-white rounded-2xl font-bold hover:bg-zinc-800 transition-all shadow-xl shadow-zinc-900/20 hover:shadow-2xl hover:-translate-y-1 flex items-center gap-2"
          >
            Browse Events
            <ArrowRight size={20} />
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {registrations.map((reg, index) => (
            <motion.div
              key={reg.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="group bg-white border border-zinc-200 rounded-[2.5rem] overflow-hidden shadow-sm hover:shadow-2xl hover:border-zinc-300 transition-all duration-500 flex flex-col md:flex-row relative"
            >
              {/* Ticket Stub / QR Section */}
              <div className="w-full md:w-64 bg-zinc-900 p-8 flex flex-col items-center justify-center relative overflow-hidden shrink-0">
                <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 to-zinc-900" />
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 via-blue-500 to-purple-600" />
                
                {/* Perforations */}
                <div className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-white rounded-full z-10 hidden md:block" />
                <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-white rounded-full z-10 hidden md:block" />
                
                <div className="relative bg-white p-3 rounded-xl shadow-lg mb-4 group-hover:scale-105 transition-transform duration-500">
                  <QRCodeSVG value={reg.qrCodeData} size={140} />
                </div>
                <div className="relative text-center">
                  <p className="text-zinc-400 text-[10px] font-bold uppercase tracking-[0.2em] mb-1">Entry Pass</p>
                  <p className="text-white font-mono text-sm opacity-50">#{reg.id.slice(0, 8)}</p>
                </div>
              </div>

              {/* Event Details Section */}
              <div className="flex-1 p-8 flex flex-col justify-between bg-white relative">
                {/* Decorative circle for perforation match */}
                <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-zinc-900 rounded-full z-10 hidden md:block" />

                <div>
                  <div className="flex items-center justify-between mb-6">
                    <div className={cn(
                      "px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border flex items-center gap-1.5",
                      reg.attended 
                        ? "bg-emerald-50 text-emerald-700 border-emerald-100" 
                        : reg.status === "pending"
                        ? "bg-amber-50 text-amber-700 border-amber-100"
                        : reg.status === "rejected"
                        ? "bg-red-50 text-red-700 border-red-100"
                        : "bg-blue-50 text-blue-700 border-blue-100"
                    )}>
                      {reg.attended ? (
                        <>
                          <CheckCircle2 size={14} />
                          Attended
                        </>
                      ) : reg.status === "pending" ? (
                        <>
                          <Clock size={14} />
                          Pending
                        </>
                      ) : reg.status === "rejected" ? (
                        <>
                          <XCircle size={14} />
                          Rejected
                        </>
                      ) : (
                        <>
                          <Ticket size={14} />
                          Confirmed
                        </>
                      )}
                    </div>
                    <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                      {format(new Date(reg.registeredAt), "MMM d")}
                    </span>
                  </div>
                  
                  <h3 className="text-2xl font-bold text-zinc-900 mb-2 line-clamp-1 group-hover:text-emerald-600 transition-colors">
                    {reg.event?.title || "Unknown Event"}
                  </h3>
                  
                  <div className="space-y-3 mt-6">
                    <div className="flex items-center gap-3 text-zinc-600">
                      <div className="w-8 h-8 rounded-full bg-zinc-50 flex items-center justify-center text-zinc-400 shrink-0">
                        <Calendar size={16} />
                      </div>
                      <span className="font-medium">{reg.event?.date ? format(new Date(reg.event.date), "PPP") : "N/A"}</span>
                    </div>
                    <div className="flex items-center gap-3 text-zinc-600">
                      <div className="w-8 h-8 rounded-full bg-zinc-50 flex items-center justify-center text-zinc-400 shrink-0">
                        <MapPin size={16} />
                      </div>
                      <span className="font-medium">{reg.event?.location || "N/A"}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-8 mt-6 border-t border-zinc-100">
                  <Link
                    to={`/event/${reg.eventId}`}
                    className="w-full py-3 rounded-xl bg-zinc-50 text-zinc-900 font-bold hover:bg-zinc-900 hover:text-white transition-all flex items-center justify-center gap-2 group/btn"
                  >
                    View Event Details
                    <ArrowRight size={18} className="group-hover/btn:translate-x-1 transition-transform" />
                  </Link>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
