import { WhatsAppIcon } from "@/components/icons";

export default function WhatsAppButton() {
  return (
    <a
      href="https://wa.me/919000000000"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with Padhaanewala on WhatsApp"
      className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg shadow-black/20 transition-transform hover:scale-105"
    >
      <WhatsAppIcon className="h-7 w-7" />
    </a>
  );
}