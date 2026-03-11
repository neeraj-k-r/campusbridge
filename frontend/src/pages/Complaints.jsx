import { useState, useEffect, useCallback } from "react";
import { db } from "../firebase";
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  updateDoc,
  doc,
  getDoc,
  getDocs,
  where,
  arrayUnion,
  arrayRemove,
  serverTimestamp,
  deleteDoc
} from "firebase/firestore";
import { toast } from "react-hot-toast";
import { motion, AnimatePresence } from "motion/react";
import Cropper from "react-easy-crop";
import {
  MessageSquare,
  ThumbsUp,
  Send,
  Clock,
  CheckCircle2,
  AlertCircle,
  User,
  MoreVertical,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Trash2,
  BadgeCheck,
  Heart,
  Camera,
  X,
  Crop,
  Sparkles,
  Lock
} from "lucide-react";
import { cn } from "../lib/utils";
import { useNotifications } from "../context/NotificationContext";

// Cloudinary Config
const CLOUDINARY_CLOUD_NAME = "dbyraj0xm";
const CLOUDINARY_UPLOAD_PRESET = "campus_posters";

function formatRelativeTime(timestamp) {
  if (!timestamp) return '';
  const now = new Date();
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const diffInSeconds = Math.floor((now - date) / 1000);

  if (diffInSeconds < 60) return 'just now';

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes} min ago`;

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) return `${diffInDays}d ago`;

  const diffInWeeks = Math.floor(diffInDays / 7);
  if (diffInWeeks < 52) return `${diffInWeeks}w ago`;

  const diffInYears = Math.floor(diffInDays / 365);
  return `${diffInYears}y ago`;
}

function renderCommentText(text) {
  if (!text) return null;
  const parts = text.split(/(@\S+)/g);
  return parts.map((part, i) => {
    if (part.startsWith('@')) {
      return <span key={i} className="text-blue-500 font-medium">{part}</span>;
    }
    return part;
  });
}

function RealNameLookup({ uid, fallback }) {
  const [name, setName] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!uid || fallback) return;

    const fetchName = async () => {
      setLoading(true);
      try {
        const userDoc = await getDoc(doc(db, "users", uid));
        if (userDoc.exists()) {
          setName(userDoc.data().displayName);
        } else {
          setName("Unknown User");
        }
      } catch (error) {
        console.error("Error fetching real name:", error);
        setName("Error Loading");
      } finally {
        setLoading(false);
      }
    };

    fetchName();
  }, [uid, fallback]);

  if (fallback) return <span>Real: {fallback}</span>;
  if (loading) return <span className="animate-pulse">Loading name...</span>;
  return <span>Real: {name || "No Name Found"}</span>;
}

const createImage = (url) =>
  new Promise((resolve, reject) => {
    const image = new Image()
    image.addEventListener('load', () => resolve(image))
    image.addEventListener('error', (error) => reject(error))
    image.setAttribute('crossOrigin', 'anonymous')
    image.src = url
  })

const getRadianAngle = (degreeValue) => {
  return (degreeValue * Math.PI) / 180
}

/**
 * Returns the new bounding area of a rotated rectangle.
 */
function rotateSize(width, height, rotation) {
  const rotRad = getRadianAngle(rotation)

  return {
    width:
      Math.abs(Math.cos(rotRad) * width) + Math.abs(Math.sin(rotRad) * height),
    height:
      Math.abs(Math.sin(rotRad) * width) + Math.abs(Math.cos(rotRad) * height),
  }
}

async function getCroppedImg(imageSrc, pixelCrop, rotation = 0) {
  const image = await createImage(imageSrc)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')

  if (!ctx) {
    return null
  }

  const rotRad = getRadianAngle(rotation)

  // calculate bounding box of the rotated image
  const { width: bBoxWidth, height: bBoxHeight } = rotateSize(
    image.width,
    image.height,
    rotation
  )

  // set canvas size to match the bounding box
  canvas.width = bBoxWidth
  canvas.height = bBoxHeight

  // translate canvas context to a central point to allow rotating and flipping around the center
  ctx.translate(bBoxWidth / 2, bBoxHeight / 2)
  ctx.rotate(rotRad)
  ctx.translate(-image.width / 2, -image.height / 2)

  // draw rotated image
  ctx.drawImage(image, 0, 0)

  // croppedAreaPixels values are bounding box relative
  // extract the cropped image using these values
  const data = ctx.getImageData(
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height
  )

  // set canvas width to final desired crop size - this will clear existing context
  canvas.width = pixelCrop.width
  canvas.height = pixelCrop.height

  // paste generated rotate image with correct offsets for x,y crop values.
  ctx.putImageData(data, 0, 0)

  return new Promise((resolve, reject) => {
    canvas.toBlob((file) => {
      resolve(file)
    }, 'image/jpeg')
  })
}

export default function Complaints({ profile }) {
  const [complaints, setComplaints] = useState([]);
  const [newComplaint, setNewComplaint] = useState("");
  const [loading, setLoading] = useState(false);
  const [deletingCommentId, setDeletingCommentId] = useState(null);
  const [expandedComments, setExpandedComments] = useState({});
  const [confirmingDeleteId, setConfirmingDeleteId] = useState(null);
  const [confirmingCommentDeleteId, setConfirmingCommentDeleteId] = useState(null);
  const [replyingTo, setReplyingTo] = useState({});
  const [expandedReplies, setExpandedReplies] = useState({});
  const { sendNotification, deleteNotificationsByRelatedId } = useNotifications();

  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [showCropper, setShowCropper] = useState(false);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [imageAspect, setImageAspect] = useState(4 / 3);
  const [faculties, setFaculties] = useState([]);
  const [selectedFacultyId, setSelectedFacultyId] = useState("");

  const isDeveloper = profile?.email === "campusbridgeofficials@gmail.com";
  const canModerate = isDeveloper || profile?.role === "management";

  const handleImageChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        const img = new Image();
        img.onload = () => {
          setImageAspect(img.width / img.height);
          setImagePreview(reader.result);
          setShowCropper(true);
        };
        img.src = reader.result;
      });
      reader.readAsDataURL(file);
    }
  };

  const onCropComplete = useCallback((croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleCropSave = async () => {
    try {
      const croppedImageBlob = await getCroppedImg(imagePreview, croppedAreaPixels, rotation);
      setImageFile(croppedImageBlob);
      setImagePreview(URL.createObjectURL(croppedImageBlob));
      setShowCropper(false);
      setRotation(0);
    } catch (e) {
      console.error(e);
      toast.error("Failed to crop image");
    }
  };

  const handleCropCancel = () => {
    setShowCropper(false);
    setImagePreview(null);
    setImageFile(null);
    setRotation(0);
  };

  useEffect(() => {
    if (!profile) return;

    const fetchFaculties = async () => {
      try {
        const q = query(collection(db, "users"), where("role", "==", "faculty"));
        const snapshot = await getDocs(q);
        const facultyData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setFaculties(facultyData);
      } catch (error) {
        console.error("Error fetching faculties:", error);
      }
    };
    fetchFaculties();

    const q = query(collection(db, "complaints"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q,
      (snapshot) => {
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })).filter(complaint => {
          if (complaint.deleted) return false;
          if (complaint.privateToFacultyId) {
            return profile.uid === complaint.authorUid ||
              profile.uid === complaint.privateToFacultyId ||
              profile.email === "campusbridgeofficials@gmail.com";
          }
          return true;
        });
        setComplaints(data);
      },
      (error) => {
        console.error("Complaints listener error:", error);
        if (error.code === "permission-denied") {
          // Only show toast if we actually have a profile, otherwise it's just a race condition
          if (profile) {
            toast.error("Access Denied: Please ensure Firestore Security Rules allow reading the 'complaints' collection.");
          }
        }
      }
    );
    return () => unsubscribe();
  }, [profile]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newComplaint.trim() && !imageFile) return;
    if (profile?.role !== "student" && profile?.role !== "faculty") {
      toast.error("Only students and faculty can register complaints.");
      return;
    }

    setLoading(true);
    try {
      let imageUrl = null;
      if (imageFile) {
        toast.loading("Uploading image...", { id: "uploadToast" });
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
          toast.success("Image uploaded!", { id: "uploadToast" });
        } else {
          throw new Error("Image upload failed");
        }
      }

      const docRef = await addDoc(collection(db, "complaints"), {
        text: newComplaint,
        imageUrl: imageUrl,
        authorCodeName: isDeveloper ? "Developer" : (profile.role === "faculty" ? profile.displayName : (profile.codeName || (profile.role === "management" ? "Management" : "Anonymous"))),
        authorRealName: profile.displayName, // Stored for developer visibility
        authorEmail: profile.email, // Added for verified badge
        authorUid: profile.uid,
        privateToFacultyId: selectedFacultyId || null,
        likes: [],
        comments: [],
        status: "pending", // pending, in-progress, resolved
        createdAt: serverTimestamp(),
      });

      // Notify management AND all users (students/faculty)
      console.log("Sending notification to management and users...");
      let recipients = [];
      if (selectedFacultyId) {
        recipients = [selectedFacultyId];
      } else {
        recipients = ["role_management", "role_student", "role_faculty"];
      }

      // Also notify the author if they are not in one of these roles (e.g. developer)
      if (!recipients.includes(`role_${profile.role}`) && !recipients.includes(profile.uid)) {
        recipients.push(profile.uid);
      }

      const authorName = profile.role === "faculty" ? profile.displayName : (profile.codeName || "Anonymous");
      await sendNotification({
        title: "New Complaint",
        message: `A new complaint has been posted by ${authorName}`,
        link: `/complaints`,
        recipients: recipients,
        type: "COMPLAINT",
        relatedId: docRef.id
      });
      console.log("Notification sent successfully.");

      setNewComplaint("");
      setImageFile(null);
      setImagePreview(null);
      setSelectedFacultyId("");
      toast.success("Complaint registered successfully!");
    } catch (error) {
      console.error("Complaint submission error:", error);
      toast.error("Failed to register complaint: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async (complaintId, likes) => {
    if (!profile) return;
    const complaintRef = doc(db, "complaints", complaintId);
    const hasLiked = likes.includes(profile.uid);

    try {
      await updateDoc(complaintRef, {
        likes: hasLiked ? arrayRemove(profile.uid) : arrayUnion(profile.uid)
      });
    } catch (error) {
      toast.error("Action failed");
    }
  };

  const handleComment = async (complaintId, commentText, parentId = null) => {
    if (!commentText.trim()) return;
    const complaintRef = doc(db, "complaints", complaintId);
    const complaint = complaints.find(c => c.id === complaintId);

    try {
      const newComment = {
        id: Date.now().toString(), // Added ID for easier deletion
        text: commentText,
        authorCodeName: isDeveloper ? "Developer" : (profile.role === "faculty" ? profile.displayName : (profile.codeName || (profile.role === "management" ? "Management" : "Anonymous"))),
        authorRealName: profile.displayName, // Stored for developer visibility
        authorEmail: profile.email, // Added for verified badge
        authorUid: profile.uid,
        createdAt: Date.now(),
        likes: []
      };
      if (parentId) {
        newComment.parentId = parentId;
      }
      await updateDoc(complaintRef, {
        comments: arrayUnion(newComment)
      });

      // Notify complaint author if someone else comments
      if (complaint && complaint.authorUid !== profile.uid) {
        await sendNotification({
          title: "New Comment",
          message: `Someone commented on your complaint`,
          link: `/complaints`,
          recipients: [complaint.authorUid],
          type: "COMPLAINT"
        });
      }
    } catch (error) {
      console.error("Comment error:", error);
      toast.error("Failed to add comment");
    }
  };

  const handleLikeComment = async (complaintId, commentToLike) => {
    if (!profile) return;

    const complaintRef = doc(db, "complaints", complaintId);
    const complaint = complaints.find(c => c.id === complaintId);

    if (!complaint) return;

    try {
      const updatedComments = complaint.comments.map(c => {
        const isMatch = (c.id && commentToLike.id && c.id === commentToLike.id) ||
          (!c.id && !commentToLike.id && c.text === commentToLike.text && c.authorUid === commentToLike.authorUid && c.createdAt === commentToLike.createdAt);

        if (isMatch) {
          const likes = c.likes || [];
          const hasLiked = likes.includes(profile.uid);
          return {
            ...c,
            likes: hasLiked ? likes.filter(uid => uid !== profile.uid) : [...likes, profile.uid]
          };
        }
        return c;
      });

      await updateDoc(complaintRef, {
        comments: updatedComments
      });
    } catch (error) {
      toast.error("Failed to like comment");
    }
  };

  const handleDeleteComplaint = async (complaintId) => {
    const complaint = complaints.find(c => c.id === complaintId);
    if (!complaint) return;

    // Allow developer or the author of the complaint to delete it
    if (!isDeveloper && complaint.authorUid !== profile?.uid) return;

    try {
      await updateDoc(doc(db, "complaints", complaintId), {
        deleted: true
      });

      // Delete associated notifications
      await deleteNotificationsByRelatedId(complaintId);

      toast.success(isDeveloper ? "Complaint deleted by Moderator" : "Complaint deleted");
      setConfirmingDeleteId(null);
    } catch (error) {
      console.error("Delete complaint error:", error);
      toast.error(error.code === 'permission-denied'
        ? "Permission Denied: Check your Firestore Security Rules."
        : "Failed to delete complaint: " + error.message);
    }
  };

  const handleDeleteComment = async (complaintId, commentToDelete) => {
    if (!isDeveloper && commentToDelete.authorUid !== profile?.uid) return;
    const commentUniqueId = commentToDelete.id || commentToDelete.createdAt;
    setDeletingCommentId(commentUniqueId);

    const complaintRef = doc(db, "complaints", complaintId);
    const complaint = complaints.find(c => c.id === complaintId);

    if (!complaint) {
      toast.error("Complaint not found");
      setDeletingCommentId(null);
      return;
    }

    try {
      // Filter out the comment to delete
      const updatedComments = complaint.comments.filter(c => {
        const isTarget = (c.id && commentToDelete.id && c.id === commentToDelete.id) ||
          (!c.id && !commentToDelete.id && c.text === commentToDelete.text && c.authorUid === commentToDelete.authorUid && c.createdAt === commentToDelete.createdAt);

        if (isTarget) return false;
        if (commentToDelete.id && c.parentId === commentToDelete.id) return false;
        return true;
      });

      if (updatedComments.length === complaint.comments.length) {
        throw new Error("Could not find the comment to delete in the list.");
      }

      await updateDoc(complaintRef, {
        comments: updatedComments
      });

      toast.success("Comment deleted");
      setConfirmingCommentDeleteId(null);
    } catch (error) {
      console.error("Delete comment error:", error);
      toast.error(error.code === 'permission-denied'
        ? "Permission Denied: Check your Firestore Security Rules."
        : "Failed to delete comment: " + error.message);
    } finally {
      setDeletingCommentId(null);
    }
  };

  const updateStatus = async (complaintId, newStatus) => {
    if (profile?.role !== "management" && !isDeveloper) return;
    const complaintRef = doc(db, "complaints", complaintId);
    const complaint = complaints.find(c => c.id === complaintId);

    try {
      await updateDoc(complaintRef, { status: newStatus });

      // Notify the author of the complaint
      if (complaint && complaint.authorUid) {
        await sendNotification({
          title: "Complaint Status Updated",
          message: `Your complaint status has been updated to ${newStatus}`,
          link: `/complaints`,
          recipients: [complaint.authorUid],
          type: "COMPLAINT"
        });
      }

      toast.success(`Status updated to ${newStatus}`);
    } catch (error) {
      console.error("Update status error:", error);
      toast.error("Failed to update status");
    }
  };

  const toggleComments = (id) => {
    setExpandedComments(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const renderCommentItem = (comment, complaintId, topLevelCommentId = null) => {
    return (
      <div key={comment.id || comment.createdAt} className="flex gap-3 group/comment">
        <div className="w-8 h-8 rounded-full bg-zinc-200 flex items-center justify-center text-xs font-bold text-zinc-500 shrink-0">
          {comment.authorEmail === "campusbridgeofficials@gmail.com" ? "D" : comment.authorCodeName.charAt(0)}
        </div>
        <div className="flex-1 min-w-0 bg-white p-3 rounded-2xl border border-zinc-100 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-zinc-900">
                {comment.authorEmail === "campusbridgeofficials@gmail.com" ? "Developer" : comment.authorCodeName}
              </span>
              {comment.authorEmail === "campusbridgeofficials@gmail.com" && (
                <BadgeCheck size={14} className="text-blue-500 fill-blue-50" />
              )}
              {isDeveloper && (
                <span className={cn(
                  "text-[9px] font-bold px-1 py-0.5 rounded border truncate max-w-[80px] inline-block align-middle",
                  comment.authorRealName
                    ? "text-emerald-600 bg-emerald-50 border-emerald-100"
                    : "text-zinc-400 bg-zinc-50 border-zinc-100"
                )}>
                  <RealNameLookup uid={comment.authorUid} fallback={comment.authorRealName} />
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] text-zinc-400">{formatRelativeTime(comment.createdAt)}</span>

            </div>
          </div>
          <p className="text-sm text-zinc-600 whitespace-pre-wrap break-all">{renderCommentText(comment.text)}</p>
          <div className="mt-2 flex items-center gap-4 shrink-0">
            <button
              onClick={() => handleLikeComment(complaintId, comment)}
              className={cn(
                "flex items-center gap-1.5 text-xs font-medium transition-colors",
                (comment.likes || []).includes(profile?.uid)
                  ? "text-red-500"
                  : "text-zinc-400 hover:text-red-500"
              )}
            >
              <Heart
                size={12}
                className={cn(
                  (comment.likes || []).includes(profile?.uid) && "fill-current"
                )}
              />
              <span>{(comment.likes || []).length}</span>
            </button>
            <button
              onClick={() => {
                const authorName = comment.authorEmail === "campusbridgeofficials@gmail.com" ? "Developer" : comment.authorCodeName;
                setReplyingTo(prev => ({
                  ...prev,
                  [complaintId]: {
                    parentId: topLevelCommentId || comment.id,
                    username: authorName
                  }
                }));
                const input = document.getElementById(`comment-input-${complaintId}`);
                if (input) {
                  const mention = `@${authorName.replace(/\s+/g, '')} `;
                  if (input.value && !input.value.includes(mention)) {
                    input.value = `${input.value} ${mention}`;
                  } else if (!input.value) {
                    input.value = mention;
                  }
                  input.focus();
                  input.dispatchEvent(new Event('input', { bubbles: true }));
                }
              }}
              className="text-xs font-medium text-zinc-400 hover:text-zinc-600 transition-colors"
            >
              Reply
            </button>
            {(isDeveloper || comment.authorUid === profile?.uid) && (
              <div className="flex items-center gap-1 shrink-0 ml-auto">
                {confirmingCommentDeleteId === (comment.id || comment.createdAt) ? (
                  <div className="flex items-center gap-1 animate-in fade-in zoom-in duration-200">
                    <button
                      onClick={() => handleDeleteComment(complaintId, comment)}
                      className="px-1.5 py-0.5 bg-red-600 text-white text-[8px] font-bold rounded hover:bg-red-700 transition-colors"
                    >
                      Confirm
                    </button>
                    <button
                      onClick={() => setConfirmingCommentDeleteId(null)}
                      className="px-1.5 py-0.5 bg-zinc-100 text-zinc-600 text-[8px] font-bold rounded hover:bg-zinc-200 transition-colors"
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmingCommentDeleteId(comment.id || comment.createdAt)}
                    disabled={deletingCommentId === (comment.id || comment.createdAt)}
                    className={cn(
                      "text-xs font-medium transition-colors",
                      deletingCommentId === (comment.id || comment.createdAt)
                        ? "text-zinc-400 animate-pulse"
                        : "text-zinc-400 hover:text-red-600"
                    )}
                    title="Delete Comment"
                  >
                    Delete
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <header className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2">
          <h1 className="text-4xl font-serif font-bold text-zinc-900">Campus Feedback</h1>
          {isDeveloper && (
            <span className="px-2 py-1 bg-zinc-900 text-white text-[10px] font-bold uppercase tracking-widest rounded-md">Dev Mode</span>
          )}
        </div>
        <p className="text-zinc-500">Share your concerns anonymously. Let's make campus better together.</p>
      </header>

      {isDeveloper && (
        <div className="bg-emerald-50 border border-emerald-100 rounded-[2rem] p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <ShieldCheck size={20} />
            </div>
            <div>
              <h2 className="font-bold text-emerald-900">Developer Dashboard</h2>
              <p className="text-xs text-emerald-600 font-medium">Logged in as {profile.email}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-emerald-100 text-center">
              <div className="text-2xl font-bold text-emerald-900">{complaints.length}</div>
              <div className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">Total Posts</div>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-emerald-100 text-center">
              <div className="text-2xl font-bold text-emerald-900">{complaints.filter(c => c.status === 'pending').length}</div>
              <div className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">Pending</div>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-emerald-100 text-center">
              <div className="text-2xl font-bold text-emerald-900">{complaints.reduce((acc, c) => acc + c.likes.length, 0)}</div>
              <div className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">Total Likes</div>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-emerald-100 text-center">
              <div className="text-2xl font-bold text-emerald-900">{complaints.reduce((acc, c) => acc + c.comments.length, 0)}</div>
              <div className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">Comments</div>
            </div>
          </div>
        </div>
      )}

      {(profile?.role === "student" || profile?.role === "faculty") ? (
        <div className="bg-white border border-zinc-200 rounded-[2rem] p-6 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-500">
                <User size={20} />
              </div>
              <span className="font-bold text-zinc-900">
                {profile?.role === "faculty" ? profile.displayName : profile.codeName}
              </span>
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest bg-zinc-50 px-2 py-1 rounded-lg border border-zinc-100">
                {profile?.role === "faculty" ? "Faculty" : "Student"}
              </span>
            </div>
            <textarea
              value={newComplaint}
              onChange={(e) => setNewComplaint(e.target.value)}
              placeholder={profile?.role === "faculty" ? "What's on your mind? (Posted under your real name)" : "What's on your mind? (Your identity remains hidden, only your code name is shown)"}
              className="w-full min-h-[120px] p-4 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-300 transition-all resize-none font-medium"
            />
            {profile?.role === "student" && (
              <div className="mb-4">
                <label className="block text-sm font-bold text-zinc-700 mb-1">Send Privately to Faculty (Optional)</label>
                <select
                  value={selectedFacultyId}
                  onChange={(e) => setSelectedFacultyId(e.target.value)}
                  className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-300 transition-all font-medium"
                >
                  <option value="">-- Public Complaint --</option>
                  {faculties.map(faculty => (
                    <option key={faculty.id} value={faculty.id}>
                      {faculty.displayName} ({faculty.department})
                    </option>
                  ))}
                </select>
                <p className="text-xs text-zinc-500 mt-1">If selected, this complaint will only be visible to the selected faculty.</p>
              </div>
            )}
            {imagePreview && !showCropper && (
              <div className="relative w-32 h-32 rounded-xl overflow-hidden border border-zinc-200">
                <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => { setImagePreview(null); setImageFile(null); }}
                  className="absolute top-1 right-1 p-1 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            )}
            <div className="flex items-center justify-between">
              <div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                  id="complaint-image-upload"
                />
                <label
                  htmlFor="complaint-image-upload"
                  className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-zinc-600 bg-zinc-100 hover:bg-zinc-200 rounded-xl cursor-pointer transition-colors"
                >
                  <Camera size={18} />
                  {imageFile ? "Change Image" : "Add Image"}
                </label>
              </div>
              <button
                type="submit"
                disabled={loading || (!newComplaint.trim() && !imageFile)}
                className="flex items-center gap-2 px-6 py-3 bg-zinc-900 text-white rounded-xl font-bold hover:bg-zinc-800 transition-all disabled:opacity-50 shadow-lg shadow-zinc-900/20"
              >
                {loading ? "Posting..." : <><Send size={18} /> Post Complaint</>}
              </button>
            </div>
          </form>
        </div>
      ) : profile ? (
        <div className="bg-zinc-100 border border-zinc-200 rounded-[2rem] p-6 text-center">
          <p className="text-zinc-500 font-medium">Only students and faculty can register new complaints.</p>
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-100 rounded-[2rem] p-6 text-center">
          <p className="text-amber-700 font-medium">Unable to load your profile. Please check your internet or contact support.</p>
        </div>
      )}

      {showCropper && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden flex flex-col h-[80vh]">
            <div className="p-4 border-b border-zinc-100 flex justify-between items-center bg-white z-10">
              <h3 className="font-bold text-zinc-900 flex items-center gap-2">
                <Crop size={20} /> Crop Image
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setRotation((prev) => (prev + 90) % 360)}
                  className="p-2 text-zinc-600 hover:text-zinc-900 rounded-full hover:bg-zinc-100 flex items-center gap-1 text-xs font-bold"
                  title="Rotate 90°"
                >
                  <Sparkles size={16} className="text-emerald-500" />
                  Rotate
                </button>
                <button onClick={handleCropCancel} className="p-2 text-zinc-400 hover:text-zinc-600 rounded-full hover:bg-zinc-100">
                  <X size={20} />
                </button>
              </div>
            </div>
            <div className="relative flex-1 bg-zinc-900">
              <Cropper
                image={imagePreview}
                crop={crop}
                zoom={zoom}
                rotation={rotation}
                aspect={imageAspect}
                onCropChange={setCrop}
                onRotationChange={setRotation}
                onCropComplete={onCropComplete}
                onZoomChange={setZoom}
              />
            </div>
            <div className="p-4 border-t border-zinc-100 bg-white z-10 flex justify-end gap-2">
              <button
                onClick={handleCropCancel}
                className="px-6 py-2 rounded-xl font-bold text-zinc-600 hover:bg-zinc-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCropSave}
                className="px-6 py-2 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-colors"
              >
                Save Crop
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-6">
        {complaints.length === 0 ? (
          <div className="bg-white border border-zinc-200 rounded-[2rem] p-12 text-center shadow-sm">
            <MessageSquare className="mx-auto text-zinc-300 mb-4" size={48} />
            <h3 className="text-xl font-bold text-zinc-900 mb-2">No complaints yet</h3>
            <p className="text-zinc-500 max-w-xs mx-auto">
              Everything seems to be going well! Check back later for new feedback.
            </p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {complaints.map((complaint) => (
              <motion.div
                key={complaint.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white border border-zinc-200 rounded-[2rem] overflow-hidden shadow-sm"
              >
                <div className="p-4 md:p-6 space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-zinc-900 text-white flex items-center justify-center font-bold">
                        {complaint.authorEmail === "campusbridgeofficials@gmail.com" ? "D" : complaint.authorCodeName.charAt(0)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-zinc-900">
                            {complaint.authorEmail === "campusbridgeofficials@gmail.com" ? "Developer" : complaint.authorCodeName}
                          </span>
                          {complaint.authorEmail === "campusbridgeofficials@gmail.com" && (
                            <BadgeCheck size={16} className="text-blue-500 fill-blue-50" />
                          )}
                          {isDeveloper && (
                            <span className={cn(
                              "text-[10px] font-bold px-1.5 py-0.5 rounded border",
                              complaint.authorRealName
                                ? "text-emerald-600 bg-emerald-50 border-emerald-100"
                                : "text-zinc-400 bg-zinc-50 border-zinc-100"
                            )}>
                              <RealNameLookup uid={complaint.authorUid} fallback={complaint.authorRealName} />
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-zinc-400 flex items-center gap-1">
                          <Clock size={12} />
                          {formatRelativeTime(complaint.createdAt)}
                          {complaint.privateToFacultyId && (
                            <span className="flex items-center gap-1 ml-2 text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-100 font-medium">
                              <Lock size={10} /> Private
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 border",
                        complaint.status === "pending" && "bg-amber-50 text-amber-600 border-amber-100",
                        complaint.status === "in-progress" && "bg-blue-50 text-blue-600 border-blue-100",
                        complaint.status === "resolved" && "bg-emerald-50 text-emerald-600 border-emerald-100"
                      )}>
                        {complaint.status === "pending" && <AlertCircle size={12} />}
                        {complaint.status === "in-progress" && <Clock size={12} />}
                        {complaint.status === "resolved" && <CheckCircle2 size={12} />}
                        {complaint.status.replace("-", " ")}
                      </div>
                      {(isDeveloper || complaint.authorUid === profile?.uid) && (
                        <div className="flex items-center gap-1">
                          {confirmingDeleteId === complaint.id ? (
                            <div className="flex items-center gap-1 animate-in fade-in zoom-in duration-200">
                              <button
                                onClick={() => handleDeleteComplaint(complaint.id)}
                                className="px-2 py-1 bg-red-600 text-white text-[10px] font-bold rounded-md hover:bg-red-700 transition-colors"
                              >
                                Confirm
                              </button>
                              <button
                                onClick={() => setConfirmingDeleteId(null)}
                                className="px-2 py-1 bg-zinc-100 text-zinc-600 text-[10px] font-bold rounded-md hover:bg-zinc-200 transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmingDeleteId(complaint.id)}
                              className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                              title="Delete Complaint"
                            >
                              <Trash2 size={18} />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <p className="text-zinc-700 leading-relaxed font-medium text-lg">
                    {complaint.text}
                  </p>

                  {complaint.imageUrl && (
                    <div className="mt-4 rounded-2xl overflow-hidden border border-zinc-200">
                      <img src={complaint.imageUrl} alt="Complaint attachment" className="w-full max-h-96 object-cover" />
                    </div>
                  )}

                  <div className="flex items-center gap-6 pt-2 border-t border-zinc-50">
                    <button
                      onClick={() => handleLike(complaint.id, complaint.likes)}
                      className={cn(
                        "flex items-center gap-2 text-sm font-bold transition-colors",
                        complaint.likes.includes(profile?.uid) ? "text-zinc-900" : "text-zinc-400 hover:text-zinc-600"
                      )}
                    >
                      <ThumbsUp size={18} className={complaint.likes.includes(profile?.uid) ? "fill-current" : ""} />
                      {complaint.likes.length}
                    </button>
                    <button
                      onClick={() => toggleComments(complaint.id)}
                      className="flex items-center gap-2 text-sm font-bold text-zinc-400 hover:text-zinc-600 transition-colors"
                    >
                      <MessageSquare size={18} />
                      {complaint.comments.length}
                    </button>
                  </div>

                  {(profile?.role === "management" || isDeveloper) && (
                    <div className="flex items-center gap-2 pt-4 border-t border-zinc-50">
                      <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest mr-2">Update Status:</span>
                      <button
                        onClick={() => updateStatus(complaint.id, "in-progress")}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-50 text-blue-600 border border-blue-100 hover:bg-blue-100 transition-colors"
                      >
                        Will be resolved
                      </button>
                      <button
                        onClick={() => updateStatus(complaint.id, "resolved")}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-600 border border-emerald-100 hover:bg-emerald-100 transition-colors"
                      >
                        Mark Solved
                      </button>
                    </div>
                  )}
                </div>

                {expandedComments[complaint.id] && (
                  <div className="bg-zinc-50/50 border-t border-zinc-100 p-6 space-y-4">
                    <div className="space-y-4">
                      {complaint.comments.filter(c => !c.parentId).map((comment, idx) => {
                        const replies = complaint.comments.filter(c => c.parentId === comment.id);
                        return (
                          <div key={idx} className="flex flex-col gap-3">
                            {renderCommentItem(comment, complaint.id)}
                            {replies.length > 0 && (
                              <div className="ml-11">
                                <button
                                  onClick={() => setExpandedReplies(prev => ({ ...prev, [comment.id]: !prev[comment.id] }))}
                                  className="text-xs font-medium text-zinc-500 hover:text-zinc-700 flex items-center gap-2 mb-3"
                                >
                                  <div className="w-6 h-[1px] bg-zinc-300"></div>
                                  {expandedReplies[comment.id] ? "Hide replies" : `View replies (${replies.length})`}
                                </button>

                                {expandedReplies[comment.id] && (
                                  <div className="space-y-3">
                                    {replies.map((reply) => renderCommentItem(reply, complaint.id, comment.id))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const input = e.target.elements.comment;
                        if (input.value.trim()) {
                          const parentId = replyingTo[complaint.id]?.parentId || null;
                          handleComment(complaint.id, input.value, parentId);
                          input.value = "";
                          input.style.height = 'auto';
                          setReplyingTo(prev => {
                            const newState = { ...prev };
                            delete newState[complaint.id];
                            return newState;
                          });
                        }
                      }}
                      className="flex gap-2 items-end"
                    >
                      <textarea
                        id={`comment-input-${complaint.id}`}
                        name="comment"
                        placeholder="Add a comment..."
                        rows={1}
                        onInput={(e) => {
                          e.target.style.height = 'auto';
                          e.target.style.height = e.target.scrollHeight + 'px';
                        }}
                        className="flex-1 px-4 py-2 bg-white border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-300 transition-all resize-none overflow-hidden min-h-[40px] max-h-[200px]"
                      />
                      <button
                        type="submit"
                        className="p-2 bg-zinc-900 text-white rounded-xl hover:bg-zinc-800 transition-all shrink-0 h-[40px] w-[40px] flex items-center justify-center"
                      >
                        <Send size={16} />
                      </button>
                    </form>
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
