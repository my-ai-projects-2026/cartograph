import { SignIn } from "@clerk/nextjs";
import { AuthFrame } from "@/ui/auth-frame";

export default function SignInPage() {
  return (
    <AuthFrame>
      <SignIn />
    </AuthFrame>
  );
}
