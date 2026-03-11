import React from 'react';
import { motion } from 'motion/react';
import { Shield, Lock, EyeOff, AlertTriangle, CheckCircle2 } from 'lucide-react';

export default function PrivacyPolicy({ onAccept, hideAccept = false }) {
  return (
    <div className="max-w-4xl mx-auto p-6 md:p-12">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white border border-zinc-200 rounded-[2.5rem] overflow-hidden shadow-2xl"
      >
        <div className="bg-zinc-900 p-8 md:p-12 text-white text-center space-y-4">
          <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mx-auto backdrop-blur-sm">
            <Shield size={32} className="text-white" />
          </div>
          <h1 className="text-3xl md:text-4xl font-serif font-bold">Privacy & Usage Policy</h1>
          <p className="text-zinc-400 max-w-lg mx-auto">Please read and accept our terms to ensure a safe and respectful campus environment.</p>
        </div>

        <div className="p-8 md:p-12 space-y-10">
          {/* Student Section */}
          <section className="space-y-4">
            <div className="flex items-center gap-3 text-zinc-900">
              <EyeOff size={24} />
              <h2 className="text-xl font-bold uppercase tracking-tight">For Students: Anonymity & Safety</h2>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-zinc-50 p-6 rounded-3xl border border-zinc-100">
                <h3 className="font-bold text-zinc-900 mb-2 flex items-center gap-2">
                  <Lock size={16} /> Anonymous Posting
                </h3>
                <p className="text-sm text-zinc-600 leading-relaxed">
                  Your complaints are registered using a unique <strong>Code Name</strong>. Your real identity is hidden from other students and the Management team by default.
                </p>
              </div>
              <div className="bg-amber-50 p-6 rounded-3xl border border-amber-100">
                <h3 className="font-bold text-amber-900 mb-2 flex items-center gap-2">
                  <AlertTriangle size={16} /> Zero Tolerance for Abuse
                </h3>
                <p className="text-sm text-amber-700 leading-relaxed">
                  If you post <strong>vulgar, offensive, or abusive</strong> content, your anonymity will be revoked. The Developer reserves the right to reveal your real identity to the administration for disciplinary action.
                </p>
              </div>
            </div>
          </section>

          {/* Management Section */}
          <section className="space-y-4">
            <div className="flex items-center gap-3 text-zinc-900">
              <Shield size={24} />
              <h2 className="text-xl font-bold uppercase tracking-tight">For Management: Data Privacy</h2>
            </div>
            <div className="bg-zinc-50 p-6 rounded-3xl border border-zinc-100">
              <ul className="space-y-4">
                <li className="flex gap-3">
                  <CheckCircle2 size={20} className="text-emerald-500 shrink-0" />
                  <p className="text-sm text-zinc-600">Student identities remain private to encourage honest feedback and campus improvement.</p>
                </li>
                <li className="flex gap-3">
                  <CheckCircle2 size={20} className="text-emerald-500 shrink-0" />
                  <p className="text-sm text-zinc-600">Real identities will only be disclosed by the Developer in cases of verified policy violations (vulgarity or harassment).</p>
                </li>
              </ul>
            </div>
          </section>

          {/* Accept Button */}
          {!hideAccept && (
            <div className="pt-6 border-t border-zinc-100">
              <button
                onClick={onAccept}
                className="w-full py-4 bg-zinc-900 text-white rounded-2xl font-bold text-lg hover:bg-zinc-800 transition-all shadow-xl shadow-zinc-900/20 active:scale-[0.98]"
              >
                I Understand and Accept
              </button>
              <p className="text-center text-xs text-zinc-400 mt-4">
                By clicking accept, you agree to abide by the campus code of conduct.
              </p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
