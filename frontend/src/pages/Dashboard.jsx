import { useEffect, useState } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { Calendar, MapPin, Users, ArrowRight, Search, Sparkles } from "lucide-react";
import { format } from "date-fns";
import { cn } from "../lib/utils";

export default function Dashboard({ profile }) {
  const [events, setEvents] = useState([]);
  const [myEvents, setMyEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        // Fetch all approved events
        const q = query(
          collection(db, "events"),
          where("status", "==", "approved")
        );
        const querySnapshot = await getDocs(q);
        const eventsData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        // Sort on client side
        eventsData.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        setEvents(eventsData);

        // If student, fetch their own events (including pending)
        if (profile?.uid) {
          const qMy = query(
            collection(db, "events"),
            where("hostId", "==", profile.uid)
          );
          const mySnapshot = await getDocs(qMy);
          const myData = mySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          myData.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
          setMyEvents(myData);
        }
      } catch (error) {
        console.error("Error fetching events:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, [profile]);

  const filteredEvents = events.filter(event => {
    // 1. Search Filter
    const matchesSearch = 
      event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      event.location.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (!matchesSearch) return false;

    // 2. Department Filter (Only for students)
    if (profile?.role === "student") {
      const allowed = event.allowedDepartments || ["ALL"];
      if (allowed.includes("ALL")) return true;
      return allowed.includes(profile.department);
    }

    return true;
  });

  // Safe date formatter
  const formatDate = (dateValue) => {
    try {
      if (!dateValue) return "TBA";
      const d = new Date(dateValue);
      if (isNaN(d.getTime())) return "TBA";
      return format(d, "MMM d");
    } catch (e) {
      return "TBA";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-zinc-900"></div>
      </div>
    );
  }

  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <section className="relative bg-zinc-900 rounded-3xl p-8 md:p-12 overflow-hidden shadow-2xl shadow-zinc-900/20">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1541339907198-e08756dedf3f?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center opacity-20 mix-blend-overlay"></div>
        <div className="absolute inset-0 bg-gradient-to-r from-zinc-900 via-zinc-900/80 to-transparent"></div>
        
        <div className="relative z-10 max-w-2xl space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-white/80 text-xs font-bold uppercase tracking-wider border border-white/10 backdrop-blur-sm"
          >
            <Sparkles size={12} className="text-emerald-400" />
            <span>Campus Life</span>
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-6xl font-serif font-bold text-white leading-tight"
          >
            Discover your next <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-emerald-200">great experience</span>
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-lg text-zinc-400 max-w-lg"
          >
            Join workshops, seminars, and cultural fests happening right now on the SNMIMT campus.
          </motion.p>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="relative max-w-md"
          >
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={20} />
            <input
              type="text"
              placeholder="Search for events, locations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-white/10 border border-white/10 rounded-2xl text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:bg-white/20 transition-all backdrop-blur-sm"
            />
          </motion.div>
        </div>
      </section>

      {/* My Events Quick Access (Only for Students who have events) */}
      {profile?.role === "student" && myEvents.length > 0 && (
        <section className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-zinc-900 flex items-center gap-2">
              <Sparkles className="text-amber-500" size={20} />
              Your Submissions
            </h2>
            <Link to="/my-events" className="text-sm font-bold text-zinc-500 hover:text-zinc-900 transition-colors">
              View All
            </Link>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
            {myEvents.slice(0, 4).map((event) => (
              <Link 
                key={event.id} 
                to={`/event/${event.id}`}
                className="flex-shrink-0 w-64 bg-white border border-zinc-200 rounded-2xl p-4 hover:shadow-md transition-all group"
              >
                <div className="aspect-video rounded-xl overflow-hidden mb-3 bg-zinc-100">
                  <img src={event.posterUrl} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform" referrerPolicy="no-referrer" />
                </div>
                <h3 className="font-bold text-zinc-900 text-sm line-clamp-1 mb-1">{event.title}</h3>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-zinc-500 font-medium uppercase">{formatDate(event.date)}</span>
                  <span className={cn(
                    "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider",
                    event.status === "approved" ? "bg-emerald-50 text-emerald-600" : 
                    event.status === "rejected" ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-600"
                  )}>
                    {event.status}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Events Grid */}
      <section>
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold text-zinc-900 flex items-center gap-2">
            <Calendar className="text-emerald-600" size={24} />
            Upcoming Events
          </h2>
          <span className="text-sm font-medium text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">
            {filteredEvents.length} {filteredEvents.length === 1 ? 'Event' : 'Events'}
          </span>
        </div>

        {filteredEvents.length === 0 ? (
          <div className="bg-white border border-zinc-200 rounded-3xl p-16 text-center shadow-sm">
            <div className="bg-zinc-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 border border-zinc-100">
              <Search className="text-zinc-300" size={32} />
            </div>
            <h3 className="text-xl font-bold text-zinc-900 mb-2">No events found</h3>
            <p className="text-zinc-500 max-w-xs mx-auto">
              We couldn't find any events matching your search. Try different keywords.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredEvents.map((event, index) => (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="group flex flex-col bg-white border border-zinc-200 rounded-3xl overflow-hidden hover:shadow-xl hover:shadow-emerald-900/5 hover:-translate-y-1 transition-all duration-300"
              >
                <Link to={`/event/${event.id}`} className="flex-1 flex flex-col">
                  <div className="aspect-[16/10] relative overflow-hidden bg-zinc-100">
                    <img
                      src={event.posterUrl}
                      alt={event.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60" />
                    <div className="absolute top-4 left-4">
                      <span className="bg-white/90 backdrop-blur-md text-zinc-900 px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider shadow-sm border border-white/20">
                        {formatDate(event.date)}
                      </span>
                    </div>
                    <div className="absolute bottom-4 left-4 right-4">
                      <div className="flex items-center gap-2 text-white/90 text-xs font-medium backdrop-blur-sm bg-black/30 px-3 py-1.5 rounded-lg w-fit">
                        <MapPin size={12} />
                        <span className="truncate max-w-[200px]">{event.location}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-6 flex-1 flex flex-col">
                    <div className="mb-4">
                      <h3 className="text-xl font-bold text-zinc-900 mb-2 line-clamp-2 group-hover:text-emerald-600 transition-colors leading-tight">
                        {event.title}
                      </h3>
                      <p className="text-zinc-500 text-sm line-clamp-2">
                        {event.description ? event.description.replace(/[#*`]/g, '') : "No description available."}
                      </p>
                    </div>
                    
                    <div className="mt-auto pt-6 border-t border-zinc-100 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center text-[10px] font-bold text-emerald-600">
                          {(event.hostName || "U").charAt(0)}
                        </div>
                        <span className="text-xs font-medium text-zinc-500 truncate max-w-[100px] uppercase">
                          {event.hostName || "Unknown Host"}
                        </span>
                      </div>
                      
                      <div className={cn(
                        "flex items-center gap-1.5 text-sm font-bold transition-colors",
                        event.capacity && event.registeredCount >= event.capacity 
                          ? "text-red-500" 
                          : "text-zinc-900 group-hover:text-emerald-600"
                      )}>
                        {event.capacity && event.registeredCount >= event.capacity ? (
                          <>Sold Out</>
                        ) : (
                          <>
                            {profile?.role?.toLowerCase() === 'student' ? 'Register' : 'Details'} <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
