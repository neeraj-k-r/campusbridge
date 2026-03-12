import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { collection, addDoc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { generateEventDescription, generateEventPoster } from "../services/gemini";
import { toast } from "react-hot-toast";
import { motion, AnimatePresence } from "motion/react";
import {
  Sparkles,
  Calendar,
  MapPin,
  Clock,
  Send,
  Loader2,
  Image as ImageIcon,
  FileText,
  Users
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { cn } from "../lib/utils";
import ImageCropper from "../components/ImageCropper";
import { useNotifications } from "../context/NotificationContext";

// ==========================================
// CLOUDINARY CONFIGURATION
// Replace these with your actual details!
// ==========================================
const CLOUDINARY_CLOUD_NAME = "dbyraj0xm";
const CLOUDINARY_UPLOAD_PRESET = "campus_posters";

export default function CreateEvent({ profile }) {
  const navigate = useNavigate();
  const { sendNotification } = useNotifications();
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [step, setStep] = useState(1);
  const [creationMode, setCreationMode] = useState("manual");
  const [manualPosterFile, setManualPosterFile] = useState(null);
  const [manualPosterPreview, setManualPosterPreview] = useState(null);
  const [manualDescription, setManualDescription] = useState("");
  const [showCropper, setShowCropper] = useState(false);
  const [tempImage, setTempImage] = useState(null);
  const [isEnhancing, setIsEnhancing] = useState(false);

  const [formData, setFormData] = useState({
    title: "",
    date: "",
    time: "",
    location: "",
    additionalDetails: "",
    capacity: 100,
    allowedDepartments: ["ALL"],
    requiresApproval: false,
    hostName: profile?.displayName || "",
  });

  const [departments, setDepartments] = useState([]);

  useEffect(() => {
    const q = collection(db, "departmentCapacity");
    const unsubscribe = onSnapshot(q,
      (snapshot) => {
        const depts = new Set();
        snapshot.docs.forEach(doc => {
          depts.add(doc.data().department);
        });
        setDepartments(Array.from(depts).sort());
      },
      (error) => {
        console.error("Departments listener error:", error);
      }
    );
    return () => unsubscribe();
  }, []);

  const toggleDepartment = (dept) => {
    setFormData(prev => {
      const current = prev.allowedDepartments;
      if (dept === "ALL") return { ...prev, allowedDepartments: ["ALL"] };

      const filtered = current.filter(d => d !== "ALL");
      const updated = filtered.includes(dept)
        ? filtered.filter(d => d !== dept)
        : [...filtered, dept];

      return { ...prev, allowedDepartments: updated.length === 0 ? ["ALL"] : updated };
    });
  };

  const [aiGenerated, setAiGenerated] = useState(null);

  const handleGenerate = async () => {
    if (!formData.title || !formData.date || !formData.location) {
      toast.error("Please fill in the basic details first");
      return;
    }

    setGenerating(true);
    try {
      const [description, posterUrl] = await Promise.all([
        generateEventDescription(formData),
        generateEventPoster(formData),
      ]);

      setAiGenerated({ description, posterUrl });
      setStep(2);
      toast.success("AI has crafted your event!");
    } catch (error) {
      console.error("Generation error:", error);
      toast.error("AI is not currently working. Please use manual entry.", { duration: 5000 });
      setCreationMode("manual");
    } finally {
      setGenerating(false);
    }
  };

  const handleEnhanceDescription = async () => {
    if (!manualDescription.trim()) {
      toast.error("Please enter a description first");
      return;
    }
    setIsEnhancing(true);
    try {
      const response = await generateEventDescription({
        ...formData,
        additionalDetails: manualDescription
      });
      setManualDescription(response.description);
      toast.success("Description enhanced by AI!");
    } catch (error) {
      console.error("Enhancement error:", error);
      toast.error("Failed to enhance description.");
    } finally {
      setIsEnhancing(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("File size must be less than 5MB");
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setTempImage(reader.result);
        setShowCropper(true);
      };
      reader.readAsDataURL(file);
    }
    e.target.value = "";
  };

  const handleCropComplete = (file, previewUrl) => {
    setManualPosterFile(file);
    setManualPosterPreview(previewUrl);
    setShowCropper(false);
    setTempImage(null);
  };

  const handleSubmit = async () => {
    if (!profile) return;

    // FIX: Check description based on which step/mode the user is in
    const finalDescription = step === 2 ? aiGenerated?.description : manualDescription;

    if (!finalDescription) {
      toast.error("Please provide a description.");
      return;
    }

    setLoading(true);
    try {
      let downloadUrl = "";

      // FIX: Use AI poster if in Step 2, otherwise use manual upload
      if (step === 2 && aiGenerated?.posterUrl) {
        downloadUrl = aiGenerated.posterUrl;
      } else if (manualPosterFile) {
        toast.loading("Uploading poster to Cloudinary...", { id: "uploadToast" });

        const uploadData = new FormData();
        uploadData.append("file", manualPosterFile);
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
          downloadUrl = uploadedJson.secure_url;
          toast.success("Poster uploaded successfully!", { id: "uploadToast" });
        } else {
          throw new Error("Cloudinary upload failed");
        }
      } else {
        downloadUrl = `https://picsum.photos/seed/${formData.title.replace(/\s+/g, '')}/800/600`;
      }

      const eventData = {
        ...formData,
        description: finalDescription,
        posterUrl: downloadUrl,
        hostId: profile.uid,
        hostName: formData.hostName,
        status: "pending",
        createdAt: Date.now(),
        registeredCount: 0,
      };

      if (profile.studentId) {
        eventData.hostStudentId = profile.studentId;
      }

      await addDoc(collection(db, "events"), eventData);

      // --- NOTIFICATION LOGIC (ALREADY PERFECT) ---
      await sendNotification({
        title: "New Event Request",
        message: `${profile.displayName} has requested approval for "${formData.title}"`,
        link: `/management`,
        recipients: ["role_management"],
        type: "EVENT"
      });
      // --- END NOTIFICATION LOGIC ---

      toast.success("Event submitted for approval!");
      navigate("/");
    } catch (error) {
      console.error("Submission error:", error);
      toast.error("Failed to submit event.", { id: "uploadToast" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      {showCropper && (
        <ImageCropper
          image={tempImage}
          onCropComplete={handleCropComplete}
          onCancel={() => {
            setShowCropper(false);
            setTempImage(null);
          }}
        // Removed the strict 16/9 aspect ratio here
        />
      )}
      <header className="mb-12 text-center max-w-2xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-100 text-zinc-600 text-xs font-bold uppercase tracking-wider mb-4"
        >
          <Sparkles size={12} className="text-emerald-500" />
          <span>Event Creator Studio</span>
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-4xl md:text-5xl font-serif font-bold text-zinc-900 mb-4"
        >
          Host an Event
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-zinc-500 text-lg"
        >
          Provide the basics, and our AI will handle the rest. Create stunning posters and descriptions in seconds.
        </motion.p>
      </header>

      <div className="flex items-center justify-center mb-16">
        <div className="relative flex items-center gap-8">
          <div className="absolute top-1/2 left-0 w-full h-0.5 bg-zinc-100 -z-10" />
          <div className="flex flex-col items-center gap-2 bg-zinc-50 px-2">
            <div className={cn(
              "w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg transition-all shadow-sm border-2",
              step >= 1 ? "bg-zinc-900 text-white border-zinc-900" : "bg-white text-zinc-400 border-zinc-200"
            )}>1</div>
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">Details</span>
          </div>
          <div className="flex flex-col items-center gap-2 bg-zinc-50 px-2">
            <div className={cn(
              "w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg transition-all shadow-sm border-2",
              step >= 2 ? "bg-zinc-900 text-white border-zinc-900" : "bg-white text-zinc-400 border-zinc-200"
            )}>2</div>
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">Review</span>
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {step === 1 ? (
          <motion.div
            key="step1"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-white border border-zinc-200 rounded-[2rem] p-8 md:p-12 shadow-xl shadow-zinc-900/5"
          >
            <div className="grid grid-cols-1 md:grid-cols-12 gap-12">
              <div className="md:col-span-7 space-y-8">
                <div>
                  <h3 className="text-xl font-bold text-zinc-900 mb-6 flex items-center gap-2">
                    <FileText size={20} className="text-zinc-400" />
                    Basic Information
                  </h3>
                  <div className="space-y-6">
                    <div>
                      <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Event Title</label>
                      <input
                        type="text"
                        required
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        className="w-full px-4 py-4 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-900/10 transition-all font-medium text-lg"
                        placeholder="e.g. Annual Tech Symposium 2026"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Event Host</label>
                      <input
                        type="text"
                        required
                        value={formData.hostName}
                        onChange={(e) => setFormData({ ...formData, hostName: e.target.value })}
                        className="w-full px-4 py-4 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-900/10 transition-all font-medium text-lg"
                        placeholder="Enter host name"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Date</label>
                        <div className="relative">
                          <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                          <input
                            type="date"
                            required
                            value={formData.date}
                            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                            className="w-full pl-12 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900/10 transition-all font-medium"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Time</label>
                        <div className="relative">
                          <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                          <input
                            type="time"
                            required
                            value={formData.time}
                            onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                            className="w-full pl-12 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900/10 transition-all font-medium"
                          />
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Location</label>
                      <div className="relative">
                        <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                        <input
                          type="text"
                          required
                          value={formData.location}
                          onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                          className="w-full pl-12 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900/10 transition-all font-medium"
                          placeholder="e.g. Main Auditorium, Block A"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-8 border-t border-zinc-100">
                  <h3 className="text-xl font-bold text-zinc-900 mb-6 flex items-center gap-2">
                    <Users size={20} className="text-zinc-400" />
                    Audience & Settings
                  </h3>
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Maximum Capacity</label>
                        <div className="relative">
                          <Users className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                          <input
                            type="number"
                            required
                            min="1"
                            value={formData.capacity}
                            onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) || 0 })}
                            className="w-full pl-12 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900/10 transition-all font-medium"
                            placeholder="e.g. 100"
                          />
                        </div>
                      </div>
                      <div className="flex items-end">
                        <div className="w-full flex items-center gap-3 p-3 bg-zinc-50 border border-zinc-200 rounded-xl hover:bg-zinc-100 transition-colors cursor-pointer" onClick={() => setFormData({ ...formData, requiresApproval: !formData.requiresApproval })}>
                          <div className={cn(
                            "w-5 h-5 rounded border flex items-center justify-center transition-all",
                            formData.requiresApproval ? "bg-zinc-900 border-zinc-900" : "bg-white border-zinc-300"
                          )}>
                            {formData.requiresApproval && <Sparkles size={12} className="text-white" />}
                          </div>
                          <div className="flex-1 select-none">
                            <span className="block text-sm font-bold text-zinc-900">Manual Approval</span>
                            <span className="block text-[10px] text-zinc-500 font-medium">Host must approve registrations</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">Allowed Departments</label>
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => toggleDepartment("ALL")}
                          className={cn(
                            "px-4 py-2 rounded-xl text-sm font-bold transition-all border",
                            formData.allowedDepartments.includes("ALL")
                              ? "bg-zinc-900 text-white border-zinc-900 shadow-lg shadow-zinc-900/20"
                              : "bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300"
                          )}
                        >
                          All Departments
                        </button>
                        {departments.map(dept => (
                          <button
                            key={dept}
                            onClick={() => toggleDepartment(dept)}
                            className={cn(
                              "px-4 py-2 rounded-xl text-sm font-bold transition-all border",
                              formData.allowedDepartments.includes(dept)
                                ? "bg-zinc-900 text-white border-zinc-900 shadow-lg shadow-zinc-900/20"
                                : "bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300"
                            )}
                          >
                            {dept}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="md:col-span-5 space-y-8">
                <div className="bg-zinc-50 rounded-3xl p-6 border border-zinc-100">
                  <h3 className="text-lg font-bold text-zinc-900 mb-6 flex items-center gap-2">
                    <FileText size={18} className="text-emerald-500" />
                    Event Content
                  </h3>

                  <div className="space-y-6">
                    <div>
                      <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Event Poster</label>
                      <div className="relative group">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleFileChange}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        />
                        <div className="w-full p-8 bg-white border-2 border-dashed border-zinc-200 rounded-xl flex flex-col items-center justify-center text-center group-hover:border-zinc-400 transition-colors">
                          {manualPosterPreview ? (
                            <div className="w-full h-auto max-h-[400px] rounded-lg overflow-hidden relative bg-zinc-100/50 flex items-center justify-center">
                              <img
                                src={manualPosterPreview}
                                alt="Preview"
                                className="w-full h-full max-h-[400px] object-contain rounded-lg shadow-sm"
                              />
                              <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white font-bold text-xs rounded-lg">
                                Click to change
                              </div>
                            </div>
                          ) : (
                            <>
                              <ImageIcon size={24} className="text-zinc-300 mb-2" />
                              <span className="text-sm font-bold text-zinc-600">Upload Poster</span>
                              <span className="text-xs text-zinc-400 mt-1">JPG, PNG up to 5MB</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider">Description</label>
                        <button
                          onClick={handleEnhanceDescription}
                          disabled={isEnhancing || !manualDescription.trim()}
                          className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 hover:text-emerald-700 disabled:opacity-50"
                        >
                          <Sparkles size={14} />
                          {isEnhancing ? "Enhancing..." : "AI Enhance"}
                        </button>
                      </div>
                      <textarea
                        value={manualDescription}
                        onChange={(e) => setManualDescription(e.target.value)}
                        className="w-full px-4 py-3 bg-white border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900/10 transition-all h-40 resize-none text-sm"
                        placeholder="Write a detailed description..."
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-4">
                  <button
                    onClick={handleSubmit}
                    disabled={loading || !manualDescription}
                    className="w-full bg-zinc-900 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-zinc-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-zinc-900/20 hover:shadow-2xl hover:shadow-zinc-900/30 hover:-translate-y-1"
                  >
                    {loading ? (
                      <Loader2 className="animate-spin" size={20} />
                    ) : (
                      <>
                        <Send size={20} />
                        <span>Submit Event</span>
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleGenerate}
                    disabled={generating}
                    className="w-full mt-4 bg-emerald-600 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-emerald-700 transition-all disabled:opacity-50 shadow-xl shadow-emerald-600/20 hover:shadow-2xl hover:-translate-y-1"
                  >
                    {generating ? (
                      <>
                        <Loader2 className="animate-spin" size={20} />
                        <span>Generating AI Magic...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles size={20} />
                        <span>Generate with AI</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="step2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-8"
          >
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-1 space-y-4">
                <div className="flex items-center gap-2 text-zinc-900 font-bold mb-2">
                  <ImageIcon size={20} />
                  <span>AI Generated Poster</span>
                </div>
                {/* Changed object-cover to object-contain here to ensure AI poster is not cropped either */}
                <div className="aspect-[3/4] rounded-3xl overflow-hidden border border-zinc-200 shadow-lg bg-zinc-100 flex items-center justify-center">
                  <img
                    src={aiGenerated?.posterUrl}
                    alt="Generated Poster"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-contain"
                  />
                </div>
                <button
                  onClick={() => setStep(1)}
                  className="w-full py-3 text-zinc-500 font-medium hover:text-zinc-900 transition-colors flex items-center justify-center gap-2"
                >
                  Edit Details
                </button>
              </div>

              <div className="lg:col-span-2 space-y-4">
                <div className="flex items-center gap-2 text-zinc-900 font-bold mb-2">
                  <FileText size={20} />
                  <span>AI Generated Description</span>
                </div>
                <div className="bg-white border border-zinc-200 rounded-3xl p-8 shadow-sm h-[500px] overflow-y-auto markdown-body">
                  <ReactMarkdown>{aiGenerated?.description || ""}</ReactMarkdown>
                </div>
              </div>
            </div>

            <div className="flex flex-col md:flex-row gap-4 pt-8 border-t border-zinc-200">
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="flex-1 py-4 px-6 rounded-2xl border border-zinc-200 font-bold text-zinc-600 hover:bg-zinc-50 transition-all flex items-center justify-center gap-2"
              >
                {generating ? <Loader2 className="animate-spin" size={20} /> : <Sparkles size={20} />}
                Regenerate Content
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="flex-[2] bg-zinc-900 text-white py-4 px-6 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-zinc-800 transition-all disabled:opacity-50 shadow-lg shadow-zinc-900/20"
              >
                {loading ? (
                  <Loader2 className="animate-spin" size={20} />
                ) : (
                  <>
                    <Send size={20} />
                    <span>Submit for Approval</span>
                  </>
                )}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}