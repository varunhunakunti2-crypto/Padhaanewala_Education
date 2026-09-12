"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { ChatIcon } from "@/components/icons";

export default function StickyCta() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const scrollY = window.scrollY;
      const nearBottom =
        window.innerHeight + scrollY >= document.documentElement.scrollHeight - 220;
      setVisible(scrollY > 600 && !nearBottom);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-4 lg:hidden"
        >
          <Link
            href="/contact"
            className="inline-flex h-12 w-full max-w-sm items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#A654F0] to-[#B04FFF] px-5 text-sm font-bold text-white shadow-lg shadow-[#A654F0]/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
          >
            <ChatIcon className="h-4 w-4" />
            Get Free Counselling
          </Link>
        </motion.div>
      )}
    </AnimatePresence>
  );
}