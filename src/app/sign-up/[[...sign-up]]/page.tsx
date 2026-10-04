import { SignUp } from "@clerk/nextjs";
import { AuthFrame } from "@/ui/auth-frame";

export default function SignUpPage() {
  return (
    <AuthFrame>
      <SignUp />
    </AuthFrame>
  );
}
