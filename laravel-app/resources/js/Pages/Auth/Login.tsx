import { Head } from "@inertiajs/react";
import { AuthForm } from "@/components/shared/auth-form";

export default function Login({
  params,
  googleEnabled,
}: {
  params: Record<string, string>;
  googleEnabled: boolean;
}) {
  return (
    <>
      <Head title="Sign in" />
      <AuthForm mode="login" params={params || {}} googleEnabled={googleEnabled} />
    </>
  );
}
