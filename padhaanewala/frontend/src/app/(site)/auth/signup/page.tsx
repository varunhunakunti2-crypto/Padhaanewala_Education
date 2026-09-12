import type { Metadata } from "next";
import SignupForm from "@/components/auth/SignupForm";

export const metadata: Metadata = {
  title: "Create account",
  description:
    "Create a free Padhaanewala account to save colleges, track scholarships and take mock tests.",
};

export default function SignupPage() {
  return <SignupForm />;
}