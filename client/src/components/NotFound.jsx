import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Home, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-radial from-zinc-900 to-zinc-950 p-6 text-center text-white">
      {/* Background decoration */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 max-w-md w-full px-6 py-12 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 backdrop-blur-xl shadow-2xl flex flex-col items-center">
        {/* Animated Icon */}
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 mb-6 animate-bounce">
          <AlertCircle className="size-8" />
        </div>

        <h1 className="text-8xl font-black tracking-widest bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent select-none drop-shadow-md">
          404
        </h1>
        
        <h2 className="text-xl font-bold mt-4 text-zinc-100">
          Page Not Found / 页面未找到
        </h2>
        
        <p className="mt-2 text-sm text-zinc-400 leading-relaxed max-w-sm">
          The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row gap-3 w-full justify-center">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white border border-zinc-700/50 text-sm font-medium transition-all duration-200 cursor-pointer"
          >
            <ArrowLeft className="size-4" />
            Go Back / 返回
          </button>
          
          <button
            onClick={() => navigate('/')}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-sm font-medium shadow-lg shadow-blue-500/25 hover:shadow-blue-500/35 transition-all duration-200 cursor-pointer"
          >
            <Home className="size-4" />
            Home / 首页
          </button>
        </div>
      </div>
    </div>
  );
}
