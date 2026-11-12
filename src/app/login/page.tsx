import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "@/components/forms";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage(props: PageProps<"/login">) {
  return (
    <>
      <SiteHeader />
      <main className="flex flex-1 items-center justify-center px-4 py-16">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Sign in or register</CardTitle>
            <CardDescription>
              No password. Enter your email and we will send you a sign-in link.
              Deal alerts go to the same address.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Suspense fallback={null}>
              <ExpiredNotice searchParams={props.searchParams} />
            </Suspense>
            <LoginForm />
          </CardContent>
        </Card>
      </main>
      <SiteFooter />
    </>
  );
}

async function ExpiredNotice({
  searchParams,
}: Pick<PageProps<"/login">, "searchParams">) {
  const { error } = await searchParams;
  if (error !== "expired") return null;
  return (
    <p role="alert" className="text-sm text-destructive">
      That sign-in link has expired or was already used. Request a new one below.
    </p>
  );
}
