import type { Metadata } from "next";
import LoginForm from "@/components/auth/LoginForm";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your Padhaanewala account to save colleges, track scholarships and take mock tests.",
};

export default function LoginPage() {
  return <LoginForm />;
}