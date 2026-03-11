import { useState, useEffect } from "react";
import { db } from "../firebase";
import { 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  onSnapshot, 
  serverTimestamp,
  deleteDoc,
  doc,
  getDocs,
  where
} from "firebase/firestore";
import { toast } from "react-hot-toast";
import { motion, AnimatePresence } from "motion/react";
import { 
  Megaphone, 
  Image as ImageIcon, 
  Send, 
  Loader2, 
  Trash2, 
  Clock,
  User,
  ShieldCheck,
  BadgeCheck,
  FileText
} from "lucide-react";
import { cn } from "../lib/utils";
import { useNotifications } from "../context/NotificationContext";
import { formatDistanceToNow } from "date-fns";

// Cloudinary Config (Reused from CreateEvent)
const CLOUDINARY_CLOUD_NAME = "dbyraj0xm";
const CLOUDINARY_UPLOAD_PRESET = "campus_posters";

export default function NoticeBoard({ profile }) {
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const { sendNotification, deleteNotificationsByRelatedId } = useNotifications();
  
  // Form State
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);

  const isDeveloper = profile?.email === "campusbridgeofficials@gmail.com";
  const role = profile?.role?.toLowerCase();
  const isManagement = role === "management";
  const isFaculty = role === "faculty";
  const canPost = isDeveloper || isManagement || isFaculty;

  useEffect(() => {
    const q = query(collection(db, "notices"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setNotices(data);
      },
      (error) => {
        console.error("Notices listener error:", error);
        toast.error("Failed to load notices");
      }
    );
    return () => unsubscribe();
  }, []);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("File size must be less than 5MB");
        return;
      }
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) {
      toast.error("Please provide a title and message");
      return;
    }

    setLoading(true);
    try {
      let imageUrl = "";

      if (imageFile) {
        setUploading(true);
        const uploadData = new FormData();
        uploadData.append("file", imageFile);
        uploadData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

        const uploadResponse = await fetch(
          `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
          {
            method: "POST",
            body: uploadData,
          }
        );

        const uploadedJson = await uploadResponse.json();

        if (uploadedJson.secure_url) {
          imageUrl = uploadedJson.secure_url;
        } else {
          throw new Error("Image upload failed");
        }
        setUploading(false);
      }

      const noticeRef = await addDoc(collection(db, "notices"), {
        title,
        message,
        imageUrl,
        authorName: profile.displayName,
        authorRole: isDeveloper ? "Developer" : profile.role,
        authorUid: profile.uid,
        createdAt: serverTimestamp(),
      });

      // Send notification to ALL users with notice ID as relatedId
      await sendNotification({
        title: "New Notice: " + title,
        message: message.substring(0, 50) + (message.length > 50 ? "..." : ""),
        link: "/notices",
        recipients: ["all"], 
        type: "INFO",
        relatedId: noticeRef.id
      });

      toast.success("Notice posted successfully!");
      setTitle("");
      setMessage("");
      setImageFile(null);
      setImagePreview(null);
    } catch (error) {
      console.error("Error posting notice:", error);
      toast.error("Failed to post notice");
    } finally {
      setLoading(false);
      setUploading(false);
    }
  };

  const [deleteId, setDeleteId] = useState(null);

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      // 1. Delete the notice
      await deleteDoc(doc(db, "notices", deleteId));

      // 2. Delete associated notifications
      await deleteNotificationsByRelatedId(deleteId);

      toast.success("Notice and associated notifications deleted");
    } catch (error) {
      console.error("Error deleting notice:", error);
      toast.error("Failed to delete notice: " + error.message);
    } finally {
      setDeleteId(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl border border-zinc-200"
            >
              <h3 className="text-lg font-bold text-zinc-900 mb-2">Delete Notice?</h3>
              <p className="text-zinc-500 mb-6">
                Are you sure you want to delete this notice? This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteId(null)}
                  className="flex-1 py-2.5 font-bold text-zinc-600 bg-zinc-100 hover:bg-zinc-200 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  className="flex-1 py-2.5 font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors shadow-lg shadow-red-600/20"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <header className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2">
          <div className="p-3 bg-zinc-900 rounded-2xl text-white shadow-lg shadow-zinc-900/20">
            <Megaphone size={24} />
          </div>
          <h1 className="text-3xl md:text-4xl font-serif font-bold text-zinc-900">Notice Board</h1>
        </div>
        <p className="text-zinc-500">Official announcements and updates from the administration.</p>
      </header>

      {canPost && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white border border-zinc-200 rounded-[2rem] p-6 md:p-8 shadow-sm"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-500">
              <ShieldCheck size={20} />
            </div>
            <div>
              <h3 className="font-bold text-zinc-900">Post a New Notice</h3>
              <p className="text-xs text-zinc-500 font-medium">
                Posting as <span className="uppercase">{isDeveloper ? "Developer" : profile.role}</span>
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Notice Title"
                className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900/10 transition-all font-bold text-lg"
              />
            </div>
            
            <div>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Write your announcement here..."
                className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900/10 transition-all min-h-[120px] resize-none"
              />
            </div>

            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <label className="block w-full cursor-pointer group">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <div className={cn(
                    "w-full h-auto min-h-[128px] border-2 border-dashed rounded-xl flex flex-col items-center justify-center transition-all overflow-hidden relative",
                    imagePreview ? "border-zinc-900 bg-zinc-900" : "border-zinc-200 group-hover:border-zinc-400 bg-zinc-50"
                  )}>
                    {imagePreview ? (
                      <>
                        <img src={imagePreview} alt="Preview" className="w-full h-auto max-h-[300px] object-contain" />
                        <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white font-bold text-xs">
                          Change Image
                        </div>
                      </>
                    ) : (
                      <>
                        <ImageIcon size={24} className="text-zinc-300 mb-2 group-hover:scale-110 transition-transform" />
                        <span className="text-xs font-bold text-zinc-500">Add Image (Optional)</span>
                      </>
                    )}
                  </div>
                </label>
                {imageFile && (
                  <button
                    type="button"
                    onClick={() => {
                      setImageFile(null);
                      setImagePreview(null);
                    }}
                    className="text-xs text-red-500 font-bold mt-2 hover:underline"
                  >
                    Remove Image
                  </button>
                )}
              </div>

              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={loading || !title || !message}
                  className="h-14 px-8 bg-zinc-900 text-white rounded-xl font-bold flex items-center gap-2 hover:bg-zinc-800 transition-all disabled:opacity-50 shadow-lg shadow-zinc-900/20 w-full md:w-auto justify-center"
                >
                  {loading ? (
                    <>
                      <Loader2 className="animate-spin" size={20} />
                      <span>{uploading ? "Uploading..." : "Posting..."}</span>
                    </>
                  ) : (
                    <>
                      <Send size={20} />
                      <span>Post Notice</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </motion.div>
      )}

      <div className="space-y-6">
        {notices.length === 0 ? (
          <div className="bg-white border border-zinc-200 rounded-[2rem] p-12 text-center shadow-sm">
            <Megaphone className="mx-auto text-zinc-300 mb-4" size={48} />
            <h3 className="text-xl font-bold text-zinc-900 mb-2">No notices yet</h3>
            <p className="text-zinc-500 max-w-xs mx-auto">
              Important announcements will appear here.
            </p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {notices.map((notice) => (
              <motion.div
                key={notice.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white border border-zinc-200 rounded-[2rem] overflow-hidden shadow-sm group"
              >
                {notice.imageUrl && (
                  <div className="w-full bg-zinc-900 flex items-center justify-center overflow-hidden border-b border-zinc-100">
                    <img 
                      src={notice.imageUrl} 
                      alt={notice.title} 
                      className="w-full h-auto max-h-[600px] object-contain group-hover:scale-[1.02] transition-transform duration-500"
                    />
                  </div>
                )}
                <div className="p-6 md:p-8">
                  <div className="flex items-start justify-between gap-4 mb-6">
                    <div className="min-w-0 flex-1">
                      <h2 className="text-xl md:text-2xl font-bold text-zinc-900 mb-3 leading-tight break-words">{notice.title}</h2>
                      <div className="flex flex-wrap items-center gap-y-2 gap-x-3 text-xs font-medium text-zinc-500">
                        <div className="flex items-center gap-1.5 bg-zinc-50 px-2 py-1 rounded-md border border-zinc-100 shrink-0">
                          <User size={12} />
                          <span>{notice.authorName}</span>
                        </div>
                        <div className={cn(
                          "flex items-center gap-1.5 px-2 py-1 rounded-md border uppercase tracking-wider text-[10px] font-bold shrink-0",
                          notice.authorRole === "Developer" && "bg-blue-50 text-blue-600 border-blue-100",
                          notice.authorRole === "management" && "bg-purple-50 text-purple-600 border-purple-100",
                          notice.authorRole === "faculty" && "bg-emerald-50 text-emerald-600 border-emerald-100"
                        )}>
                          <BadgeCheck size={12} />
                          <span>{notice.authorRole}</span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Clock size={12} />
                          <span>
                            {notice.createdAt?.toDate 
                              ? formatDistanceToNow(notice.createdAt.toDate(), { addSuffix: true }) 
                              : "Just now"}
                          </span>
                        </div>
                      </div>
                    </div>
                    {/* Delete Button: Developer can delete all. Management can delete non-dev notices. Faculty can only delete their own. */ }
                    {(isDeveloper || (isManagement && notice.authorRole !== 'Developer') || (isFaculty && notice.authorUid === profile?.uid)) && (
                      <button
                        onClick={() => setDeleteId(notice.id)}
                        className="text-[10px] md:text-xs font-bold text-red-500 md:text-zinc-400 hover:text-red-600 transition-all uppercase tracking-wider shrink-0 pt-1 px-2 py-1 -mr-2"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                  
                  <p className="text-zinc-600 leading-relaxed whitespace-pre-wrap">
                    {notice.message}
                  </p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
