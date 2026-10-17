import { Head } from "@inertiajs/react";
import { AuthForm } from "@/components/shared/auth-form";

export default function Register({
  params,
  googleEnabled,
}: {
  params: Record<string, string>;
  googleEnabled: boolean;
}) {
  return (
    <>
      <Head title="Create account" />
      <AuthForm mode="register" params={params || {}} googleEnabled={googleEnabled} />
    </>
  );
}
