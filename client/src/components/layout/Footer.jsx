import React from 'react';
import { Bus, ShieldCheck, Zap, Heart } from 'lucide-react';
import { Link } from 'react-router-dom';

export const Footer = () => {
  return (
    <footer className="bg-navy-950 text-white border-t border-slate-800 pt-16 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 pb-12 border-b border-slate-800/80">
          {/* Brand */}
          <div className="space-y-4 md:col-span-1">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-brand-500 text-white flex items-center justify-center font-bold">
                <Bus className="w-6 h-6" />
              </div>
              <span className="text-xl font-black tracking-tight">
                Shuttle <span className="text-accent-blue">Tracker</span>
              </span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Enterprise-grade real-time institutional shuttle management and GPS tracking system. Designed for campus communities.
            </p>
            <div className="flex items-center gap-3 pt-2 text-xs text-slate-400">
              <span className="inline-flex items-center gap-1">
                <ShieldCheck className="w-4 h-4 text-emerald-400" /> 99.9% Uptime
              </span>
              <span className="inline-flex items-center gap-1">
                <Zap className="w-4 h-4 text-amber-400" /> Live WebSockets
              </span>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-4">
              Platform
            </h4>
            <ul className="space-y-2.5 text-xs text-slate-400">
              <li><a href="#features" className="hover:text-white transition-colors">Live GPS Tracking</a></li>
              <li><a href="#how-it-works" className="hover:text-white transition-colors">Predictive ETA Engine</a></li>
              <li><Link to="/login" className="hover:text-white transition-colors">Driver Console</Link></li>
              <li><Link to="/login" className="hover:text-white transition-colors">Admin Fleet Hub</Link></li>
            </ul>
          </div>

          {/* Account Roles */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-4">
              Access Portals
            </h4>
            <ul className="space-y-2.5 text-xs text-slate-400">
              <li><Link to="/login?role=admin" className="hover:text-white transition-colors">Administrator Portal</Link></li>
              <li><Link to="/login?role=driver" className="hover:text-white transition-colors">Driver Cockpit</Link></li>
              <li><Link to="/login?role=user" className="hover:text-white transition-colors">Passenger & Student App</Link></li>
              <li><Link to="/login" className="hover:text-white transition-colors">Create Account</Link></li>
            </ul>
          </div>

          {/* Safety & Contact */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-4">
              Campus Security
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed mb-3">
              Need transport assistance or emergency campus shuttle dispatch?
            </p>
            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs">
              <span className="text-slate-400 block">Campus Transit Hotline:</span>
              <span className="font-bold text-accent-blue text-sm">+1 (800) 555-SHUTTLE</span>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4">
          <p>© {new Date().getFullYear()} ShuttleTrack Systems Inc. Built for institutional reliability.</p>
          <p className="flex items-center gap-1">
            Engineered with <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" /> for campus transit
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
