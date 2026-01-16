import { useState } from "react";
import { Link } from "react-router-dom";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Mail, Fingerprint, ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";

type LoginStep = "email" | "passkey" | "magic-link-sent";

export default function LoginPage() {
	const [email, setEmail] = useState("");
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);
	const [passkeyLoading, setPasskeyLoading] = useState(false);
	const [step, setStep] = useState<LoginStep>("email");
	const [_hasPasskey, setHasPasskey] = useState(false);
	const [checkingPasskey, setCheckingPasskey] = useState(false);

	async function checkForPasskey(emailToCheck: string): Promise<boolean> {
		try {
			// Use relative URL to go through Vite proxy in development
			const response = await fetch(
				`/api/user/has-passkey/${encodeURIComponent(emailToCheck)}`,
			);
			if (response.ok) {
				const data = await response.json();
				return data.hasPasskey === true;
			}
			return false;
		} catch {
			return false;
		}
	}

	async function handleEmailSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError("");
		setCheckingPasskey(true);

		try {
			const userHasPasskey = await checkForPasskey(email);
			setHasPasskey(userHasPasskey);

			if (userHasPasskey) {
				// User has passkey - show passkey sign-in
				setStep("passkey");
			} else {
				// No passkey - send magic link directly
				await sendMagicLink();
			}
		} catch (err) {
			const message =
				err instanceof Error ? err.message : "Something went wrong";
			setError(message);
		} finally {
			setCheckingPasskey(false);
		}
	}

	async function sendMagicLink() {
		setLoading(true);
		setError("");

		try {
			await authClient.signIn.magicLink({
				email,
				callbackURL: "/app?auth=magic-link",
			});

			setStep("magic-link-sent");

			// In development, check if there's a magic link to show
			if (import.meta.env.DEV) {
				setTimeout(async () => {
					try {
						const response = await fetch(
							`/api/dev/magic-link/${encodeURIComponent(email)}`,
						);
						if (response.ok) {
							const data = await response.json();
							if (data.url) {
								toast.success("Development Magic Link", {
									description: "Click to sign in instantly",
									action: {
										label: "Sign In",
										// biome-ignore lint/suspicious/noAssignInExpressions: <explanation>
										onClick: () => (window.location.href = data.url),
									},
									duration: 300000, // 5 minutes
								});
							}
						}
					} catch {
						// Silently fail - not critical
					}
				}, 500);
			}
		} catch (err) {
			const message =
				err instanceof Error ? err.message : "Failed to send sign-in link";
			setError(message);
			console.error(err);
		} finally {
			setLoading(false);
		}
	}

	async function handlePasskeySignIn() {
		setError("");
		setPasskeyLoading(true);

		try {
			const result = await authClient.signIn.passkey();
			// Passkey auth is local, so we navigate manually on success
			if (result?.data) {
				window.location.href = "/app";
			}
		} catch (err) {
			console.error("Passkey sign-in error:", err);

			// Check if it's a 401 (no passkey found) or other auth error
			const errObj = err as { status?: number; message?: string };
			if (
				errObj.status === 401 ||
				errObj.message?.includes("401") ||
				errObj.message?.includes("No passkey")
			) {
				setError(
					"No passkey found for this device. Try using a magic link instead.",
				);
			} else if (
				errObj.message?.includes("cancelled") ||
				errObj.message?.includes("abort")
			) {
				// User cancelled the passkey prompt - don't show error
				setError("");
			} else {
				setError(errObj.message || "Failed to sign in with passkey");
			}
		} finally {
			setPasskeyLoading(false);
		}
	}

	function handleBack() {
		setStep("email");
		setError("");
		setHasPasskey(false);
	}

	// Magic link sent confirmation screen
	if (step === "magic-link-sent") {
		return (
			<div className="min-h-screen flex items-center justify-center bg-background p-4">
				<div className="w-full max-w-md">
					<Card>
						<CardHeader className="text-center">
							<div className="flex justify-center mb-4">
								<div className="rounded-full bg-primary/10 p-3">
									<Mail className="h-12 w-12 text-primary" />
								</div>
							</div>
							<CardTitle>Check your email</CardTitle>
							<CardDescription>
								We've sent a sign-in link to <strong>{email}</strong>
							</CardDescription>
						</CardHeader>

						<CardContent className="space-y-4">
							<div className="bg-muted rounded-lg p-4 space-y-2">
								<p className="text-sm font-medium">Next steps:</p>
								<ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
									<li>Open the email we just sent you</li>
									<li>Click the sign-in link</li>
									<li>Start transcribing!</li>
								</ol>
							</div>

							<div className="text-sm text-muted-foreground">
								<p className="font-medium mb-1">Note:</p>
								<ul className="list-disc list-inside space-y-1">
									<li>The link expires in 5 minutes</li>
									<li>Check your spam folder if you don't see it</li>
								</ul>
							</div>
						</CardContent>

						<CardFooter className="flex flex-col gap-2">
							<Button
								onClick={() => sendMagicLink()}
								variant="outline"
								className="w-full"
								disabled={loading}
							>
								{loading ? "Sending..." : "Send Another Link"}
							</Button>
							<Button onClick={handleBack} variant="ghost" className="w-full">
								<ArrowLeft className="mr-2 h-4 w-4" />
								Use a Different Email
							</Button>
						</CardFooter>
					</Card>
				</div>
			</div>
		);
	}

	// Passkey sign-in screen (shown when user has passkey)
	if (step === "passkey") {
		return (
			<div className="min-h-screen flex items-center justify-center bg-background p-4">
				<div className="w-full max-w-md space-y-8">
					<div className="text-center">
						<h1 className="text-4xl font-bold">Welcome back</h1>
						<p className="text-muted-foreground mt-2">
							Sign in with your passkey
						</p>
					</div>

					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<Fingerprint className="h-5 w-5" />
								Use Your Passkey
							</CardTitle>
							<CardDescription>
								Sign in instantly with biometrics or your security key
							</CardDescription>
						</CardHeader>

						<CardContent className="space-y-4">
							{error && (
								<div className="p-3 bg-destructive/10 border border-destructive rounded-lg text-destructive text-sm">
									{error}
								</div>
							)}

							<div className="p-4 bg-muted rounded-lg text-center">
								<p className="text-sm text-muted-foreground mb-1">
									Signing in as
								</p>
								<p className="font-medium">{email}</p>
							</div>

							<Button
								onClick={handlePasskeySignIn}
								disabled={passkeyLoading}
								className="w-full"
								size="lg"
							>
								{passkeyLoading ? (
									<>
										<Loader2 className="mr-2 h-4 w-4 animate-spin" />
										Authenticating...
									</>
								) : (
									<>
										<Fingerprint className="mr-2 h-4 w-4" />
										Sign In with Passkey
									</>
								)}
							</Button>
						</CardContent>

						<CardFooter className="flex flex-col gap-4">
							<div className="relative w-full">
								<div className="absolute inset-0 flex items-center">
									<span className="w-full border-t" />
								</div>
								<div className="relative flex justify-center text-xs uppercase">
									<span className="bg-background px-2 text-muted-foreground">
										Or use another method
									</span>
								</div>
							</div>

							<Button
								onClick={() => sendMagicLink()}
								disabled={loading}
								variant="outline"
								className="w-full"
							>
								{loading ? (
									<>
										<Loader2 className="mr-2 h-4 w-4 animate-spin" />
										Sending...
									</>
								) : (
									<>
										<Mail className="mr-2 h-4 w-4" />
										Send Magic Link Instead
									</>
								)}
							</Button>

							<Button onClick={handleBack} variant="ghost" className="w-full">
								<ArrowLeft className="mr-2 h-4 w-4" />
								Use a Different Email
							</Button>
						</CardFooter>
					</Card>

					<div className="text-center">
						<Link
							to="/"
							className="text-sm text-muted-foreground hover:text-foreground"
						>
							Back to home
						</Link>
					</div>
				</div>
			</div>
		);
	}

	// Email entry screen (initial step)
	return (
		<div className="min-h-screen flex items-center justify-center bg-background p-4">
			<div className="w-full max-w-md space-y-8">
				<div className="text-center">
					<h1 className="text-4xl font-bold">Welcome back</h1>
					<p className="text-muted-foreground mt-2">
						Enter your email to sign in
					</p>
				</div>

				<Card>
					<CardHeader>
						<CardTitle>Sign In</CardTitle>
						<CardDescription>
							We'll sign you in with a passkey or magic link
						</CardDescription>
					</CardHeader>
					<form onSubmit={handleEmailSubmit}>
						<CardContent className="space-y-4">
							{error && (
								<div className="p-3 bg-destructive/10 border border-destructive rounded-lg text-destructive text-sm">
									{error}
								</div>
							)}

							<div className="space-y-2">
								<Label htmlFor="email">Email</Label>
								<Input
									id="email"
									type="email"
									value={email}
									onChange={(e) => setEmail(e.target.value)}
									required
									placeholder="you@example.com"
									autoFocus
									disabled={checkingPasskey}
								/>
							</div>

							<div className="bg-muted rounded-lg p-3 text-sm text-muted-foreground">
								<strong>Passwordless & secure:</strong> We'll use your passkey
								if you have one, or send you a magic link.
							</div>
						</CardContent>

						<CardFooter className="flex flex-col gap-4">
							<Button
								type="submit"
								disabled={checkingPasskey || !email}
								className="w-full"
							>
								{checkingPasskey ? (
									<>
										<Loader2 className="mr-2 h-4 w-4 animate-spin" />
										Checking...
									</>
								) : (
									"Continue"
								)}
							</Button>

							<p className="text-center text-sm text-muted-foreground">
								New to Transcriber?{" "}
								<Link to="/signup" className="text-primary hover:underline">
									Create an account
								</Link>
							</p>
						</CardFooter>
					</form>
				</Card>

				<div className="text-center">
					<Link
						to="/"
						className="text-sm text-muted-foreground hover:text-foreground"
					>
						Back to home
					</Link>
				</div>
			</div>
		</div>
	);
}
