import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    X,
    PlayCircle, // Kept in case you use it later
    HelpCircle,
    UserCircle,
    GraduationCap,
    ChevronDown,
    ChevronUp,
    BookOpen,
    MessageSquare
} from "lucide-react";

const STUDENT_VIDEO = "https://res.cloudinary.com/dtzdgkimi/video/upload/v1773851900/studentsignup_b2mvk9.mp4";
const FACULTY_VIDEO = "https://res.cloudinary.com/dtzdgkimi/video/upload/v1773851903/facultysignup_hsmyee.mp4";

// Updated FAQs with new text and optional image properties
const FAQS = [
    {
        question: "How do I change my password?",
        answer: "Go to your Account. Under that, there will be a 'Change Password' section.",
        image: "https://res.cloudinary.com/dtzdgkimi/image/upload/v1773852410/changepass_uui5hd.jpg"
    },
    {
        question: "Where can I find event tickets?",
        answer: "Once you register for an event, your tickets are available in the 'My Tickets' section of your dashboard. You can also find them by clicking on your profile icon in the navbar and selecting 'My Tickets'."
    },
    {
        question: "How do I report a complaint?",
        answer: "Go to your Account, then navigate to the 'Contact Developer' section. From there, you can send a message on Instagram or via Email.",
        image: "https://res.cloudinary.com/dtzdgkimi/image/upload/v1773852563/contact_developer_ugbb4h.jpg"
    }
];

export default function HelpAssistant({ isOpen, onClose }) {
    const [activeTab, setActiveTab] = useState("tutorials");
    const [expandedFaq, setExpandedFaq] = useState(null);

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60]"
                    />

                    {/* Assistant Panel */}
                    <motion.div
                        initial={{ x: "100%" }}
                        animate={{ x: 0 }}
                        exit={{ x: "100%" }}
                        transition={{ type: "spring", damping: 25, stiffness: 200 }}
                        className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white z-[70] shadow-2xl flex flex-col"
                    >
                        {/* Header */}
                        <div className="p-6 border-b border-zinc-100 flex items-center justify-between bg-emerald-600 text-white">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                                    <HelpCircle size={24} />
                                </div>
                                <div>
                                    <h2 className="font-bold text-lg">Help Assistant</h2>
                                    <p className="text-xs text-emerald-100">Tutorials & FAQs</p>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        {/* Tabs */}
                        <div className="flex border-b border-zinc-100">
                            <button
                                onClick={() => setActiveTab("tutorials")}
                                className={`flex-1 py-4 text-sm font-bold transition-all relative flex items-center justify-center gap-2 ${activeTab === "tutorials" ? "text-emerald-600" : "text-zinc-400 hover:text-zinc-600"
                                    }`}
                            >
                                <BookOpen size={18} />
                                Tutorials
                                {activeTab === "tutorials" && (
                                    <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-600" />
                                )}
                            </button>
                            <button
                                onClick={() => setActiveTab("faqs")}
                                className={`flex-1 py-4 text-sm font-bold transition-all relative flex items-center justify-center gap-2 ${activeTab === "faqs" ? "text-emerald-600" : "text-zinc-400 hover:text-zinc-600"
                                    }`}
                            >
                                <MessageSquare size={18} />
                                FAQs
                                {activeTab === "faqs" && (
                                    <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-600" />
                                )}
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-hidden flex flex-col">
                            {activeTab === "tutorials" ? (
                                <div className="flex-1 overflow-y-auto p-6 space-y-8">
                                    {/* Student Video */}
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                                                <UserCircle size={24} />
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-zinc-900">Student Registration</h3>
                                                <p className="text-xs text-zinc-500">Step-by-step guide for students</p>
                                            </div>
                                        </div>
                                        <div className="aspect-video rounded-2xl overflow-hidden bg-black shadow-lg border border-zinc-100">
                                            <video
                                                src={STUDENT_VIDEO}
                                                controls
                                                className="w-full h-full object-contain"
                                            />
                                        </div>
                                    </div>

                                    {/* Faculty Video */}
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                                                <GraduationCap size={24} />
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-zinc-900">Faculty Registration</h3>
                                                <p className="text-xs text-zinc-500">Guide for teachers and staff</p>
                                            </div>
                                        </div>
                                        <div className="aspect-video rounded-2xl overflow-hidden bg-black shadow-lg border border-zinc-100">
                                            <video
                                                src={FACULTY_VIDEO}
                                                controls
                                                className="w-full h-full object-contain"
                                            />
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                                    <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-4">Common Questions</h3>
                                    {FAQS.map((faq, index) => (
                                        <div
                                            key={index}
                                            className="border border-zinc-100 rounded-2xl overflow-hidden bg-zinc-50/50"
                                        >
                                            <button
                                                onClick={() => setExpandedFaq(expandedFaq === index ? null : index)}
                                                className="w-full flex items-center justify-between p-4 text-left hover:bg-zinc-100 transition-colors"
                                            >
                                                <span className="text-sm font-bold text-zinc-900">{faq.question}</span>
                                                {expandedFaq === index ? (
                                                    <ChevronUp size={18} className="text-emerald-600 min-w-[18px]" />
                                                ) : (
                                                    <ChevronDown size={18} className="text-zinc-400 min-w-[18px]" />
                                                )}
                                            </button>
                                            <AnimatePresence>
                                                {expandedFaq === index && (
                                                    <motion.div
                                                        initial={{ height: 0, opacity: 0 }}
                                                        animate={{ height: "auto", opacity: 1 }}
                                                        exit={{ height: 0, opacity: 0 }}
                                                        className="overflow-hidden"
                                                    >
                                                        <div className="p-4 pt-0 text-sm text-zinc-600 leading-relaxed border-t border-zinc-100/50">
                                                            <p>{faq.answer}</p>
                                                            {/* Conditionally render image if it exists in the FAQ object */}
                                                            {faq.image && (
                                                                <div className="mt-4 rounded-xl overflow-hidden shadow-sm border border-zinc-200">
                                                                    <img
                                                                        src={faq.image}
                                                                        alt={faq.question}
                                                                        className="w-full h-auto object-cover"
                                                                    />
                                                                </div>
                                                            )}
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="p-4 bg-zinc-50 border-t border-zinc-100 text-center">
                            <p className="text-[10px] text-zinc-400 font-medium">
                                CampusBridge Support • SNMIMT Engineering College
                            </p>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}