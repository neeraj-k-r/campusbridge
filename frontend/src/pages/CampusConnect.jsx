import { useState, useEffect, useRef, useCallback } from "react";
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc, updateDoc, setDoc } from "firebase/firestore";
import { EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";
import { auth, db } from "../firebase";
import { motion, AnimatePresence } from "motion/react";
import Cropper from "react-easy-crop";
import { Send, GraduationCap, MessageSquare, Sparkles, Trash2, X, Check, BarChart3, Plus, User, Users, Camera, Crop, Lock, Search } from "lucide-react";
import { cn } from "../lib/utils";
import { format } from "date-fns";
import toast from "react-hot-toast";

// --- NEW IMPORT ADDED HERE ---
import { useNotifications } from "../context/NotificationContext";

const CLOUDINARY_CLOUD_NAME = "dbyraj0xm";
const CLOUDINARY_UPLOAD_PRESET = "campus_posters";

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
  const { width: bBoxWidth, height: bBoxHeight } = rotateSize(
    image.width,
    image.height,
    rotation
  )

  canvas.width = bBoxWidth
  canvas.height = bBoxHeight

  ctx.translate(bBoxWidth / 2, bBoxHeight / 2)
  ctx.rotate(rotRad)
  ctx.translate(-image.width / 2, -image.height / 2)

  ctx.drawImage(image, 0, 0)

  const data = ctx.getImageData(
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height
  )

  canvas.width = pixelCrop.width
  canvas.height = pixelCrop.height

  ctx.putImageData(data, 0, 0)

  return new Promise((resolve, reject) => {
    canvas.toBlob((file) => {
      resolve(file)
    }, 'image/jpeg')
  })
}

export default function CampusConnect({ user, profile }) {
  const [messages, setMessages] = useState([]);
  const [polls, setPolls] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [activeTab, setActiveTab] = useState("chat"); // "chat", "polls", or "directory"
  const [searchQuery, setSearchQuery] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [showPollCreator, setShowPollCreator] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["", ""]);
  const [pollTarget, setPollTarget] = useState("all");
  const [isCreatingPoll, setIsCreatingPoll] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [showCropper, setShowCropper] = useState(false);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [imageAspect, setImageAspect] = useState(1);
  const [pollToDelete, setPollToDelete] = useState(null);
  const [deletePassword, setDeletePassword] = useState("");
  const [isDeletingPoll, setIsDeletingPoll] = useState(false);
  const messagesEndRef = useRef(null);

  // --- NOTIFICATION HOOK INITIALIZED HERE ---
  const { sendNotification } = useNotifications();

  useEffect(() => {
    // Chat messages listener
    const qChat = query(
      collection(db, "alumniChat"),
      orderBy("createdAt", "asc")
    );

    const unsubscribeChat = onSnapshot(qChat, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setMessages(msgs);
      setLoading(false);
      scrollToBottom();
    });

    // Polls listener
    const qPolls = query(
      collection(db, "polls"),
      orderBy("createdAt", "desc")
    );

    const unsubscribePolls = onSnapshot(qPolls, (snapshot) => {
      const pollData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setPolls(pollData);
    }, (error) => {
      console.error("Polls listener error:", error);
    });

    // Users listener
    const qUsers = query(
      collection(db, "users"),
      orderBy("displayName", "asc")
    );

    const unsubscribeUsers = onSnapshot(qUsers, (snapshot) => {
      const usersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setUsersList(usersData);
    }, (error) => {
      console.error("Users listener error:", error);
    });

    return () => {
      unsubscribeChat();
      unsubscribePolls();
      unsubscribeUsers();
    };
  }, []);

  const handleCreatePoll = async (e) => {
    e.preventDefault();
    const validOptions = pollOptions.filter(opt => opt.trim() !== "");
    if (!pollQuestion.trim() || validOptions.length < 2) {
      toast.error("Please provide a question and at least 2 options");
      return;
    }

    setIsCreatingPoll(true);
    try {
      await addDoc(collection(db, "polls"), {
        question: pollQuestion.trim(),
        options: validOptions,
        targetAudience: pollTarget,
        votes: {}, // userId: optionIndex
        createdBy: user.uid,
        creatorName: profile.displayName,
        createdAt: serverTimestamp()
      });
      toast.success("Poll created successfully!");
      setPollQuestion("");
      setPollOptions(["", ""]);
      setPollTarget("all");
      setShowPollCreator(false);
    } catch (error) {
      console.error("Error creating poll:", error);
      toast.error("Failed to create poll");
    } finally {
      setIsCreatingPoll(false);
    }
  };

  const handleVote = async (pollId, optionIndex) => {
    try {
      const poll = polls.find(p => p.id === pollId);
      const currentVote = poll?.votes?.[user.uid];

      if (currentVote === optionIndex) return;

      const pollRef = doc(db, "polls", pollId);
      await updateDoc(pollRef, {
        [`votes.${user.uid}`]: optionIndex
      });

      toast.success(currentVote !== undefined ? "Vote updated!" : "Vote cast!");
    } catch (error) {
      console.error("Error voting:", error);
      toast.error("Failed to cast vote");
    }
  };

  const handleDeletePoll = async (e) => {
    e.preventDefault();
    if (!pollToDelete || !deletePassword) return;

    setIsDeletingPoll(true);
    try {
      // Re-authenticate user
      const credential = EmailAuthProvider.credential(user.email, deletePassword);
      await reauthenticateWithCredential(auth.currentUser, credential);

      // If successful, delete the poll
      await deleteDoc(doc(db, "polls", pollToDelete));
      toast.success("Poll deleted successfully");
      setPollToDelete(null);
      setDeletePassword("");
    } catch (error) {
      console.error("Error deleting poll:", error);
      if (error.code === "auth/wrong-password") {
        toast.error("Incorrect password. Please try again.");
      } else {
        toast.error("Failed to delete poll. Verification failed.");
      }
    } finally {
      setIsDeletingPoll(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const isDeveloper = profile?.email?.toLowerCase() === "campusbridgeofficials@gmail.com";

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

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if ((!newMessage.trim() && !imageFile) || !profile) return;

    setIsSending(true);
    try {
      let imageUrl = null;
      if (imageFile) {
        const uploadToastId = toast.loading("Uploading image...");
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
          toast.success("Image uploaded!", { id: uploadToastId });
        } else {
          toast.error("Image upload failed", { id: uploadToastId });
          throw new Error("Image upload failed");
        }
      }

      await addDoc(collection(db, "alumniChat"), {
        text: newMessage.trim(),
        imageUrl: imageUrl,
        senderId: user.uid,
        senderName: profile.displayName,
        senderEmail: profile.email,
        senderRole: isDeveloper ? "developer" : profile.role,
        senderDept: isDeveloper ? "Admin" : (profile.department || "Management"),
        createdAt: serverTimestamp()
      });

      // --- NEW NOTIFICATION TRIGGER ---
      // This alerts "all" users that a new message was posted
      await sendNotification({
        title: "Campus Connect",
        message: `${profile.displayName} posted a new message in the chat.`,
        link: "/campus-connect", // Assuming this is the route for this page
        recipients: ["all"],
        type: "CHAT"
      });
      // --- END NEW NOTIFICATION TRIGGER ---

      setNewMessage("");
      setImageFile(null);
      setImagePreview(null);
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Failed to send message");
    } finally {
      setIsSending(false);
    }
  };

  const handleDeleteMessage = (messageId) => {
    toast((t) => (
      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium text-zinc-900">Delete this message?</p>
        <div className="flex gap-2">
          <button
            onClick={async () => {
              toast.dismiss(t.id);
              try {
                await deleteDoc(doc(db, "alumniChat", messageId));
                toast.success("Message deleted");
              } catch (error) {
                console.error("Error deleting message:", error);
                toast.error("Failed to delete message");
              }
            }}
            className="flex-1 bg-red-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-red-600 transition-colors flex items-center justify-center gap-1"
          >
            <Check size={14} /> Yes
          </button>
          <button
            onClick={() => toast.dismiss(t.id)}
            className="flex-1 bg-zinc-100 text-zinc-700 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-zinc-200 transition-colors flex items-center justify-center gap-1"
          >
            <X size={14} /> No
          </button>
        </div>
      </div>
    ), { duration: 5000 });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-80px)]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  return (
    <div className="w-full lg:max-w-[98%] mx-auto h-screen lg:h-[calc(100vh-40px)] flex flex-col bg-white lg:rounded-3xl shadow-2xl lg:border border-zinc-200 overflow-hidden">
      {/* Header */}
      <div className="bg-zinc-900 p-4 lg:p-6 text-white flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3 lg:gap-4">
          <div className="w-10 h-10 lg:w-12 lg:h-12 bg-emerald-500/20 rounded-xl lg:rounded-2xl flex items-center justify-center text-emerald-400">
            <GraduationCap size={20} className="lg:w-6 lg:h-6" />
          </div>
          <div>
            <h1 className="text-lg lg:text-2xl font-bold flex items-center gap-2">
              Campus Connect
              <Sparkles className="text-amber-400 lg:w-5 lg:h-5" size={16} />
            </h1>
            <p className="text-zinc-400 text-[10px] lg:text-sm">Connect with alumni and current students</p>
          </div>
        </div>
        {(profile?.role?.toLowerCase() === "management" || isDeveloper) && (
          <button
            onClick={() => setShowPollCreator(true)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-emerald-600/20"
          >
            <Plus size={18} />
            <span className="hidden sm:inline">Create Poll</span>
          </button>
        )}
      </div>

      {/* Mobile Tab Switcher */}
      <div className="lg:hidden flex border-b border-zinc-200 bg-white p-1 gap-1 shrink-0">
        <button
          onClick={() => setActiveTab("chat")}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold transition-all",
            activeTab === "chat"
              ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/20"
              : "text-zinc-500 hover:bg-zinc-50"
          )}
        >
          <MessageSquare size={16} />
          Chat
        </button>
        <button
          onClick={() => setActiveTab("polls")}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold transition-all",
            activeTab === "polls"
              ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/20"
              : "text-zinc-500 hover:bg-zinc-50"
          )}
        >
          <BarChart3 size={16} />
          Polls
        </button>
        <button
          onClick={() => setActiveTab("directory")}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold transition-all",
            activeTab === "directory"
              ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/20"
              : "text-zinc-500 hover:bg-zinc-50"
          )}
        >
          <Users size={16} />
          Directory
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Main Chat Area */}
        <div className={cn(
          "flex-1 flex flex-col min-w-0 bg-white relative",
          activeTab !== "chat" && "hidden lg:flex"
        )}>
          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-4 lg:p-8 space-y-4 lg:space-y-8 bg-zinc-50/30 custom-scrollbar">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-zinc-400 space-y-4">
                <div className="w-16 h-16 lg:w-20 lg:h-20 bg-zinc-100 rounded-2xl lg:rounded-3xl flex items-center justify-center">
                  <MessageSquare size={32} className="lg:w-10 lg:h-10 opacity-20" />
                </div>
                <div className="text-center">
                  <p className="font-bold text-zinc-900">No messages yet</p>
                  <p className="text-xs lg:text-sm">Be the first to say hello!</p>
                </div>
              </div>
            ) : (
              messages.map((msg, index) => {
                const isMe = msg.senderId === user.uid;
                const showHeader = index === 0 || messages[index - 1].senderId !== msg.senderId;

                return (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    key={msg.id}
                    className={cn(
                      "flex flex-col max-w-[92%] lg:max-w-[85%]",
                      isMe ? "ml-auto items-end" : "mr-auto items-start"
                    )}
                  >
                    {showHeader && (
                      <div className={cn(
                        "flex items-center gap-2 mb-1 px-1",
                        isMe ? "flex-row-reverse" : "flex-row"
                      )}>
                        <span className="text-sm font-bold text-zinc-700">{msg.senderName}</span>
                        {msg.senderId && (
                          <span className="text-[9px] text-zinc-400 font-mono">
                            ID: {(() => {
                              const u = usersList.find(user => user.id === msg.senderId);
                              return u?.studentId || u?.facultyId || (u?.email === "campusbridgeofficials@gmail.com" ? "DEV-001" : "N/A");
                            })()}
                          </span>
                        )}
                        <span className={cn(
                          "text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider",
                          msg.senderEmail === "campusbridgeofficials@gmail.com" || msg.senderRole === "developer" ? "bg-indigo-100 text-indigo-700" :
                            msg.senderRole === "alumni" ? "bg-amber-100 text-amber-700" :
                              msg.senderRole === "faculty" ? "bg-purple-100 text-purple-700" :
                                msg.senderRole === "management" ? "bg-red-100 text-red-700" :
                                  "bg-emerald-100 text-emerald-700"
                        )}>
                          {msg.senderEmail === "campusbridgeofficials@gmail.com" ? "developer" : msg.senderRole}
                        </span>
                      </div>
                    )}

                    <div className="flex items-center gap-2 relative group w-full">
                      {!isMe && (isDeveloper || msg.senderId === user.uid) && (
                        <button
                          onClick={() => handleDeleteMessage(msg.id)}
                          className="opacity-0 group-hover:opacity-100 p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all shrink-0"
                          title="Delete message"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                      <div className={cn(
                        "px-4 py-3 rounded-2xl shadow-sm relative",
                        isMe
                          ? "bg-emerald-600 text-white rounded-tr-sm ml-auto"
                          : "bg-white border border-zinc-200 text-zinc-800 rounded-tl-sm"
                      )}>
                        {msg.imageUrl && (
                          <div className="mb-2 rounded-xl overflow-hidden border border-white/10">
                            <img
                              src={msg.imageUrl}
                              alt="Shared"
                              className="max-w-full h-auto object-cover max-h-80"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                        )}
                        {msg.text && <p className="text-base leading-relaxed whitespace-pre-wrap break-words">{msg.text}</p>}
                        <span className={cn(
                          "text-[10px] absolute bottom-1 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap",
                          isMe ? "right-full mr-2 text-zinc-400" : "left-full ml-2 text-zinc-400"
                        )}>
                          {msg.createdAt?.toDate() ? format(msg.createdAt.toDate(), "h:mm a") : "..."}
                        </span>
                      </div>
                      {isMe && (isDeveloper || msg.senderId === user.uid) && (
                        <button
                          onClick={() => handleDeleteMessage(msg.id)}
                          className="opacity-0 group-hover:opacity-100 p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all shrink-0"
                          title="Delete message"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </motion.div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Message Input */}
          <div className="p-3 lg:p-6 bg-white border-t border-zinc-200 shrink-0">
            {imagePreview && !showCropper && (
              <div className="mb-3 lg:mb-4 relative w-20 h-20 lg:w-24 lg:h-24 rounded-xl overflow-hidden border-2 border-emerald-500 shadow-lg animate-in slide-in-from-bottom-2">
                <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => { setImagePreview(null); setImageFile(null); }}
                  className="absolute top-1 right-1 p-1 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors"
                >
                  <X size={10} />
                </button>
              </div>
            )}
            <form onSubmit={handleSendMessage} className="flex gap-2 items-end">
              <div className="flex-1 relative">
                <textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type your message..."
                  rows={1}
                  className="w-full px-4 lg:px-6 py-3 lg:py-4 bg-zinc-50 border border-zinc-200 rounded-xl lg:rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all resize-none custom-scrollbar text-sm lg:text-base"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage(e);
                    }
                  }}
                />
                <div className="absolute right-2 bottom-2 flex items-center gap-1">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                    id="chat-image-upload"
                  />
                  <label
                    htmlFor="chat-image-upload"
                    className="p-1.5 lg:p-2 text-zinc-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg cursor-pointer transition-all"
                    title="Add image"
                  >
                    <Camera size={18} className="lg:w-5 lg:h-5" />
                  </label>
                </div>
              </div>
              <button
                type="submit"
                disabled={isSending || (!newMessage.trim() && !imageFile)}
                className="px-4 lg:px-8 py-3 lg:py-4 bg-emerald-600 text-white font-bold rounded-xl lg:rounded-2xl hover:bg-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-emerald-600/20 h-[46px] lg:h-[58px]"
              >
                {isSending ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Send size={16} className="lg:w-4.5 lg:h-4.5" />
                    <span className="hidden sm:inline">Send</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Sidebar for Polls & Directory - Desktop Only (and Mobile when active) */}
        <div className={cn(
          "lg:flex w-full lg:w-80 border-l border-zinc-200 flex-col bg-zinc-50/50",
          activeTab === "chat" ? "hidden" : "flex"
        )}>
          <div className="hidden lg:flex p-2 border-b border-zinc-200 bg-white gap-1">
            <button
              onClick={() => setActiveTab("polls")}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all",
                activeTab === "polls"
                  ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/20"
                  : "text-zinc-500 hover:bg-zinc-100"
              )}
            >
              <BarChart3 size={16} />
              Polls
            </button>
            <button
              onClick={() => setActiveTab("directory")}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all",
                activeTab === "directory"
                  ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/20"
                  : "text-zinc-500 hover:bg-zinc-100"
              )}
            >
              <Users size={16} />
              Directory
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
            {activeTab === "polls" ? (
              polls.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <div className="w-12 h-12 bg-zinc-100 rounded-2xl flex items-center justify-center mx-auto mb-4 text-zinc-400">
                    <BarChart3 size={24} />
                  </div>
                  <p className="text-sm text-zinc-500 font-medium">No active polls at the moment.</p>
                </div>
              ) : (
                polls.filter(p => p.targetAudience === "all" || p.targetAudience === profile?.role?.toLowerCase()).map(poll => {
                  const totalVotes = Object.keys(poll.votes || {}).length;
                  const userVote = poll.votes?.[user.uid];
                  const hasVoted = userVote !== undefined;

                  return (
                    <motion.div
                      key={poll.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="bg-white rounded-2xl p-4 shadow-sm border border-zinc-200 relative group"
                    >
                      {(isDeveloper || poll.createdBy === user.uid) && (
                        <button
                          onClick={() => setPollToDelete(poll.id)}
                          className="absolute top-2 right-2 p-2 text-zinc-400 hover:text-red-500 lg:opacity-0 lg:group-hover:opacity-100 transition-all bg-white/80 backdrop-blur-sm rounded-lg shadow-sm lg:shadow-none"
                          title="Delete Poll"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                      <h4 className="font-bold text-sm text-zinc-900 mb-3 pr-6">{poll.question}</h4>

                      <div className="space-y-2">
                        {poll.options.map((opt, idx) => {
                          const optVotes = Object.values(poll.votes || {}).filter(v => v === idx).length;
                          const percentage = totalVotes > 0 ? Math.round((optVotes / totalVotes) * 100) : 0;

                          return (
                            <button
                              key={idx}
                              onClick={() => handleVote(poll.id, idx)}
                              className={cn(
                                "w-full relative h-10 rounded-lg border transition-all overflow-hidden text-left px-3",
                                hasVoted
                                  ? userVote === idx
                                    ? "border-emerald-500 bg-emerald-50/30"
                                    : "border-zinc-100 bg-zinc-50/30"
                                  : "border-zinc-200 hover:border-emerald-300 hover:bg-emerald-50/30"
                              )}
                            >
                              {hasVoted && (
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${percentage}%` }}
                                  className={cn(
                                    "absolute inset-y-0 left-0 opacity-20",
                                    userVote === idx ? "bg-emerald-600" : "bg-zinc-400"
                                  )}
                                />
                              )}
                              <div className="relative z-10 flex items-center justify-between h-full">
                                <span className={cn(
                                  "text-xs font-bold truncate pr-2",
                                  hasVoted && userVote === idx ? "text-emerald-700" : "text-zinc-700"
                                )}>
                                  {opt}
                                </span>
                                {hasVoted && (
                                  <span className={cn(
                                    "text-[10px] font-bold shrink-0",
                                    userVote === idx ? "text-emerald-600" : "text-zinc-500"
                                  )}>
                                    {optVotes} {optVotes === 1 ? 'vote' : 'votes'} ({percentage}%)
                                  </span>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                      <div className="mt-3 flex items-center justify-between text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                        <span>{totalVotes} votes</span>
                        {hasVoted && <span className="text-emerald-600 flex items-center gap-1"><Check size={10} /> Voted</span>}
                      </div>
                    </motion.div>
                  );
                })
              )
            ) : (
              <div className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                  <input
                    type="text"
                    placeholder="Search members..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-white border border-zinc-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  />
                </div>

                <div className="space-y-2">
                  {usersList
                    .filter(u =>
                      u.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      u.role?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      u.department?.toLowerCase().includes(searchQuery.toLowerCase())
                    )
                    .map((u) => (
                      <motion.div
                        key={u.id}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white p-3 rounded-2xl border border-zinc-200 flex items-center gap-3 group hover:border-emerald-200 transition-all"
                      >
                        <div className="w-10 h-10 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-400 font-bold overflow-hidden shrink-0">
                          {u.photoURL ? (
                            <img src={u.photoURL} alt={u.displayName} className="w-full h-full object-cover" />
                          ) : (
                            u.displayName?.charAt(0)
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <h5 className="text-xs font-bold text-zinc-900 truncate">{u.displayName}</h5>
                            <span className={cn(
                              "text-[8px] px-1 py-0.5 rounded font-bold uppercase tracking-wider shrink-0",
                              u.email === "campusbridgeofficials@gmail.com" || u.role === "developer" ? "bg-indigo-100 text-indigo-700" :
                                u.role === "alumni" ? "bg-amber-100 text-amber-700" :
                                  u.role === "faculty" ? "bg-purple-100 text-purple-700" :
                                    u.role === "management" ? "bg-red-100 text-red-700" :
                                      "bg-emerald-100 text-emerald-700"
                            )}>
                              {u.email === "campusbridgeofficials@gmail.com" ? "developer" : u.role}
                            </span>
                          </div>
                          <p className="text-[10px] text-zinc-500 truncate">{u.email === "campusbridgeofficials@gmail.com" ? "System Admin" : (u.department || "Campus Member")}</p>
                          {(u.studentId || u.facultyId || u.email === "campusbridgeofficials@gmail.com") && (
                            <p className="text-[9px] text-zinc-400 font-mono mt-0.5">
                              ID: {u.studentId || u.facultyId || (u.email === "campusbridgeofficials@gmail.com" ? "DEV-001" : "")}
                            </p>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  {usersList.length === 0 && (
                    <div className="text-center py-8">
                      <p className="text-xs text-zinc-400">No members found</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Polls View - Only visible on small screens when there are polls */}
      <div className="lg:hidden bg-zinc-50 border-t border-zinc-200 p-4 overflow-x-auto flex gap-4 shrink-0 no-scrollbar">
        {polls.filter(p => p.targetAudience === "all" || p.targetAudience === profile?.role?.toLowerCase()).map(poll => {
          const totalVotes = Object.keys(poll.votes || {}).length;
          const userVote = poll.votes?.[user.uid];
          const hasVoted = userVote !== undefined;

          return (
            <div key={poll.id} className="min-w-[280px] bg-white rounded-2xl p-4 shadow-sm border border-zinc-200 relative">
              {(isDeveloper || poll.createdBy === user.uid) && (
                <button
                  onClick={() => setPollToDelete(poll.id)}
                  className="absolute top-2 right-2 p-2 text-zinc-400 hover:text-red-500 transition-all bg-zinc-50 rounded-lg"
                  title="Delete Poll"
                >
                  <Trash2 size={16} />
                </button>
              )}
              <h4 className="font-bold text-sm text-zinc-900 mb-3 truncate pr-8">{poll.question}</h4>
              <div className="space-y-2 mb-3">
                {poll.options.map((opt, idx) => {
                  const optVotes = Object.values(poll.votes || {}).filter(v => v === idx).length;
                  const percentage = totalVotes > 0 ? Math.round((optVotes / totalVotes) * 100) : 0;

                  return (
                    <button
                      key={idx}
                      onClick={() => handleVote(poll.id, idx)}
                      className={cn(
                        "w-full relative h-8 rounded-lg border transition-all overflow-hidden text-left px-3",
                        hasVoted
                          ? userVote === idx
                            ? "border-emerald-500 bg-emerald-50/30"
                            : "border-zinc-100 bg-zinc-50/30"
                          : "border-zinc-200 hover:border-emerald-300 hover:bg-emerald-50/30"
                      )}
                    >
                      {hasVoted && (
                        <div
                          style={{ width: `${percentage}%` }}
                          className={cn(
                            "absolute inset-y-0 left-0 opacity-20",
                            userVote === idx ? "bg-emerald-600" : "bg-zinc-400"
                          )}
                        />
                      )}
                      <div className="relative z-10 flex items-center justify-between h-full">
                        <span className={cn(
                          "text-[10px] font-bold truncate pr-2",
                          hasVoted && userVote === idx ? "text-emerald-700" : "text-zinc-700"
                        )}>
                          {opt}
                        </span>
                        {hasVoted && (
                          <span className={cn(
                            "text-[9px] font-bold shrink-0",
                            userVote === idx ? "text-emerald-600" : "text-zinc-500"
                          )}>
                            {optVotes}v ({percentage}%)
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="flex gap-2 items-center justify-between">
                <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                  {totalVotes} votes
                </div>
                {hasVoted && (
                  <div className="text-emerald-600 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                    <Check size={10} /> Voted
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Poll Creator Modal */}
      <AnimatePresence>
        {showPollCreator && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-zinc-900 flex items-center gap-2">
                  <BarChart3 className="text-emerald-600" size={24} />
                  Create a Poll
                </h3>
                <button onClick={() => setShowPollCreator(false)} className="p-2 text-zinc-400 hover:text-zinc-600 rounded-full hover:bg-zinc-100">
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleCreatePoll} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 ml-1">Question</label>
                  <input
                    type="text"
                    required
                    value={pollQuestion}
                    onChange={(e) => setPollQuestion(e.target.value)}
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium"
                    placeholder="What's on your mind?"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 ml-1">Options</label>
                  {pollOptions.map((opt, idx) => (
                    <div key={idx} className="flex gap-2">
                      <input
                        type="text"
                        required={idx < 2}
                        value={opt}
                        onChange={(e) => {
                          const newOpts = [...pollOptions];
                          newOpts[idx] = e.target.value;
                          setPollOptions(newOpts);
                        }}
                        className="flex-1 px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium"
                        placeholder={`Option ${idx + 1}`}
                      />
                      {pollOptions.length > 2 && (
                        <button
                          type="button"
                          onClick={() => setPollOptions(pollOptions.filter((_, i) => i !== idx))}
                          className="p-3 text-zinc-400 hover:text-red-500 transition-colors"
                        >
                          <X size={18} />
                        </button>
                      )}
                    </div>
                  ))}
                  {pollOptions.length < 5 && (
                    <button
                      type="button"
                      onClick={() => setPollOptions([...pollOptions, ""])}
                      className="text-sm font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 ml-1"
                    >
                      <Plus size={16} /> Add Option
                    </button>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 ml-1">Target Audience</label>
                  <div className="grid grid-cols-3 gap-2">
                    {["all", "student", "faculty"].map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setPollTarget(t)}
                        className={cn(
                          "py-2 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all",
                          pollTarget === t
                            ? "bg-emerald-600 text-white border-emerald-600 shadow-lg shadow-emerald-600/10"
                            : "bg-white text-zinc-400 border-zinc-100 hover:border-zinc-200"
                        )}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isCreatingPoll}
                  className="w-full py-4 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-600/20 disabled:opacity-50 mt-4"
                >
                  {isCreatingPoll ? "Creating..." : "Launch Poll"}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Poll Deletion Confirmation Modal */}
      <AnimatePresence>
        {pollToDelete && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-red-100 flex items-center justify-center text-red-600">
                    <Lock size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-zinc-900">Confirm Deletion</h3>
                    <p className="text-xs text-zinc-400">Security verification required</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setPollToDelete(null);
                    setDeletePassword("");
                  }}
                  className="p-2 text-zinc-400 hover:text-zinc-600 rounded-full hover:bg-zinc-100"
                >
                  <X size={24} />
                </button>
              </div>

              <p className="text-sm text-zinc-600 mb-6">
                To delete this poll, please enter your account password to confirm your identity.
              </p>

              <form onSubmit={handleDeletePoll} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 ml-1">Password</label>
                  <input
                    type="password"
                    required
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all font-medium"
                    placeholder="Enter your password"
                    autoFocus
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPollToDelete(null);
                      setDeletePassword("");
                    }}
                    className="flex-1 py-3 text-sm font-bold text-zinc-500 bg-zinc-100 hover:bg-zinc-200 rounded-xl transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isDeletingPoll || !deletePassword}
                    className="flex-[2] py-3 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-all shadow-lg shadow-red-600/20 disabled:opacity-50"
                  >
                    {isDeletingPoll ? "Verifying..." : "Confirm Delete"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Image Cropper Modal */}
      <AnimatePresence>
        {showCropper && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-[2.5rem] w-full max-w-3xl overflow-hidden flex flex-col h-[85vh] shadow-2xl"
            >
              <div className="p-6 border-b border-zinc-100 flex justify-between items-center bg-white shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-600">
                    <Crop size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-zinc-900">Crop Image</h3>
                    <p className="text-xs text-zinc-400">Adjust your image for the community</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setRotation((prev) => (prev + 90) % 360)}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-zinc-600 hover:bg-zinc-100 rounded-xl transition-all"
                  >
                    <Sparkles size={16} className="text-amber-500" />
                    Rotate
                  </button>
                  <button
                    onClick={handleCropCancel}
                    className="p-2 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-full transition-all"
                  >
                    <X size={24} />
                  </button>
                </div>
              </div>

              <div className="relative flex-1 bg-zinc-950">
                <Cropper
                  image={imagePreview}
                  crop={crop}
                  zoom={zoom}
                  rotation={rotation}
                  aspect={imageAspect}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={onCropComplete}
                />
              </div>

              <div className="p-8 bg-white border-t border-zinc-100 shrink-0">
                <div className="flex flex-col gap-6">
                  <div className="flex items-center gap-6">
                    <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest shrink-0">Zoom</span>
                    <input
                      type="range"
                      value={zoom}
                      min={1}
                      max={3}
                      step={0.1}
                      aria-labelledby="Zoom"
                      onChange={(e) => setZoom(Number(e.target.value))}
                      className="flex-1 h-1.5 bg-zinc-100 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                    />
                  </div>
                  <div className="flex gap-4">
                    <button
                      onClick={handleCropCancel}
                      className="flex-1 py-4 text-sm font-bold text-zinc-500 bg-zinc-100 hover:bg-zinc-200 rounded-2xl transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleCropSave}
                      className="flex-[2] py-4 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-2xl transition-all shadow-xl shadow-emerald-600/20"
                    >
                      Save & Continue
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}