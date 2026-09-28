import React, { useState } from 'react';
import { X, Mail, Phone, MessageSquare, Send, CheckCircle2, MapPin } from 'lucide-react';
import { useShop } from '../context/ShopContext';

export const ContactModal: React.FC = () => {
  const { isContactModalOpen, setIsContactModalOpen, showToast, shippingInfo } = useShop();
  const [name, setName] = useState(shippingInfo.fullName || '');
  const [email, setEmail] = useState(shippingInfo.email || '');
  const [subject, setSubject] = useState('Digital Book Download Assistance');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);

  if (!isContactModalOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    showToast('Your message has been sent! Our support team will reply within 2 hours.');
    setTimeout(() => {
      setSubmitted(false);
      setIsContactModalOpen(false);
      setMessage('');
    }, 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="fixed inset-0"
        onClick={() => setIsContactModalOpen(false)}
      />

      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 z-10 animate-in zoom-in-95 duration-200">
        <button
          onClick={() => setIsContactModalOpen(false)}
          className="absolute top-4 right-4 p-1 text-slate-400 hover:text-slate-600 rounded-lg"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 font-['Plus_Jakarta_Sans',sans-serif]">Need Help?</h3>
            <p className="text-xs text-slate-500">Our academic advisors and support team are here for you.</p>
          </div>
        </div>

        {submitted ? (
          <div className="py-8 text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
            <h4 className="text-base font-bold text-slate-900">Message Received!</h4>
            <p className="text-xs text-slate-500">
              We have dispatched your ticket to our dedicated exam counselors.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Your Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full text-sm px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full text-sm px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:border-emerald-600"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Topic</label>
                <select
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full text-sm px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:border-emerald-600 bg-white"
                >
                  <option>Digital Book Download Assistance</option>
                  <option>Physical Book Delivery Status</option>
                  <option>Course / Mock Test Guidance</option>
                  <option>Bulk Order Inquiry</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Message</label>
              <textarea
                rows={3}
                required
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="How can we assist with your exam preparation?"
                className="w-full text-sm px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:border-emerald-600"
              ></textarea>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl space-y-2 text-xs text-slate-600">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <a href="tel:+916282377918" className="flex items-center gap-1.5 hover:text-emerald-700 transition-colors">
                  <Phone className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>+91 6282377918</span>
                </a>
                <a href="mailto:aylembookstore@gmail.com" className="flex items-center gap-1.5 hover:text-emerald-700 transition-colors">
                  <Mail className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>aylembookstore@gmail.com</span>
                </a>
              </div>
              <div className="pt-2 border-t border-slate-200/80 text-[11px] text-slate-500 leading-relaxed flex items-start gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                <span>Aylem Learning PVT, 34/1000 edappally junction, kochi, ernakulam, keralam 682024</span>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-[#00875a] hover:bg-[#00734c] text-white font-semibold rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4" />
              <span>Send Message</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
