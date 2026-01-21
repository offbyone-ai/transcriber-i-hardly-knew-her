import {
	useTheme,
	getAvailableThemes,
	type ThemePreset,
	type ThemeInfo,
} from "./theme-provider";
import { Check, Sun, Moon, Monitor, ChevronDown } from "lucide-react";
import { useState, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";

// Theme color palette mapping - showing 4 key colors from each theme
const themeColors: Record<ThemePreset, string[]> = {
	// General themes
	default: ["#171717", "#ffffff", "#a3a3a3", "#525252"],
	forest: ["#1e7f5c", "#059669", "#34d399", "#6ee7b7"],
	nature: ["#44803f", "#65a34e", "#8bc34a", "#aed581"],
	america: ["#b91c1c", "#1e3a8a", "#ffffff", "#94a3b8"],
	ocean: ["#0c4a6e", "#0284c7", "#38bdf8", "#7dd3fc"],
	sunset: ["#ea580c", "#f59e0b", "#fbbf24", "#fcd34d"],

	// Taylor Swift Eras Tour themes
	fearless: ["#5C3A21", "#B76B1B", "#D4A017", "#F4D03F"],
	speaknow: ["#4B1D5A", "#8B2D8B", "#BE6DDF", "#D8B4FE"],
	red: ["#6B0D0D", "#DC2626", "#B91C1C", "#FCA5A5"],
	nineteen89: ["#60A5FA", "#93C5FD", "#3B82F6", "#DDEAFE"],
	reputation: ["#000000", "#444444", "#B91C1C", "#FBBF24"],
	lover: ["#F9A8D4", "#FBCFE8", "#FDE68A", "#FEE2E2"],
	folklore: ["#9CA3AF", "#8FA34A", "#C59B4D", "#7B5A2B"],
	evermore: ["#5C2D21", "#B76B1B", "#D97706", "#C19A6B"],
	lavender: ["#7c3aed", "#a78bfa", "#c4b5fd", "#ddd6fe"],
	ttpd: ["#78716c", "#a8a29e", "#d6d3d1", "#f5f5f4"],

	// Seasonal themes
	halloween: ["#ea580c", "#171717", "#78350f", "#f97316"],
	winter: ["#b91c1c", "#15803d", "#fbbf24", "#ffffff"],
	valentine: ["#e11d48", "#f43f5e", "#fb7185", "#fda4af"],
	spring: ["#86efac", "#fcd34d", "#c4b5fd", "#f9a8d4"],
};

// Category labels
const categoryLabels: Record<string, string> = {
	general: "General",
	"eras-tour": "Eras Tour",
	seasonal: "Seasonal",
};

// Mini card component for each theme
function ThemeCard({
	theme,
	isSelected,
	onSelect,
	onHover,
	onHoverEnd,
}: {
	theme: ThemeInfo;
	isSelected: boolean;
	onSelect: () => void;
	onHover: () => void;
	onHoverEnd: () => void;
}) {
	const colors = themeColors[theme.value];

	return (
		<button
			type="button"
			onClick={onSelect}
			onMouseEnter={onHover}
			onMouseLeave={onHoverEnd}
			className={cn(
				"relative flex flex-col items-center gap-1.5 p-2 rounded-lg border transition-all duration-200",
				"hover:scale-105 hover:shadow-md hover:border-primary/50",
				"focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1",
				isSelected
					? "border-primary bg-primary/10 shadow-sm"
					: "border-border bg-card hover:bg-accent/50",
			)}
		>
			{/* Color preview grid */}
			<div className="grid grid-cols-2 gap-0.5">
				{colors.map((color, i) => (
					<div
						key={`${color}-${
							// biome-ignore lint/suspicious/noArrayIndexKey: fake
							i
						}`}
						className="w-4 h-4 rounded border border-black/10 dark:border-white/10"
						style={{ backgroundColor: color }}
					/>
				))}
			</div>

			{/* Theme name */}
			<div className="flex items-center justify-center gap-0.5 w-full">
				<span className="text-[10px] font-medium truncate leading-tight">
					{theme.label}
				</span>
				{theme.seasonal?.emoji && (
					<span className="text-[10px] shrink-0">{theme.seasonal.emoji}</span>
				)}
			</div>

			{/* Selected indicator */}
			{isSelected && (
				<div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary flex items-center justify-center shadow">
					<Check size={10} className="text-primary-foreground" />
				</div>
			)}
		</button>
	);
}

export function ThemeSwitcher() {
	const { preset, mode, setPreset, setMode } = useTheme();
	const [previewTheme, setPreviewTheme] = useState<ThemePreset | null>(null);
	const previewTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const availableThemes = getAvailableThemes();

	// Group themes by category
	const themesByCategory = availableThemes.reduce(
		(acc, theme) => {
			const category = theme.category || "general";
			if (!acc[category]) acc[category] = [];
			acc[category].push(theme);
			return acc;
		},
		{} as Record<string, ThemeInfo[]>,
	);

	// Apply preview theme on hover
	const handleHover = useCallback((themeValue: ThemePreset) => {
		// Clear any pending timeout
		if (previewTimeoutRef.current) {
			clearTimeout(previewTimeoutRef.current);
		}

		setPreviewTheme(themeValue);

		// Apply preview to document
		const root = window.document.documentElement;
		if (themeValue === "default") {
			root.removeAttribute("data-theme");
		} else {
			root.setAttribute("data-theme", themeValue);
		}
	}, []);

	// Restore original theme on hover end
	const handleHoverEnd = useCallback(() => {
		// Small delay to prevent flicker when moving between cards
		previewTimeoutRef.current = setTimeout(() => {
			setPreviewTheme(null);

			// Restore original theme
			const root = window.document.documentElement;
			if (preset === "default") {
				root.removeAttribute("data-theme");
			} else {
				root.setAttribute("data-theme", preset);
			}
		}, 100);
	}, [preset]);

	// Select and persist theme
	const handleSelect = useCallback(
		(themeValue: ThemePreset) => {
			// Clear any pending timeout
			if (previewTimeoutRef.current) {
				clearTimeout(previewTimeoutRef.current);
			}
			setPreviewTheme(null);
			setPreset(themeValue);
		},
		[setPreset],
	);

	return (
		<div className="space-y-6">
			{/* Mode Toggle */}
			<div>
				<div className="text-sm text-muted-foreground mb-3 font-medium">
					Color Mode
				</div>
				<div className="flex gap-1 p-1 bg-accent/50 rounded-lg">
					<button
						type="button"
						onClick={() => setMode("light")}
						className={cn(
							"flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition",
							mode === "light"
								? "bg-background shadow-sm text-foreground"
								: "text-muted-foreground hover:text-foreground",
						)}
						title="Light mode"
					>
						<Sun size={16} />
						<span className="hidden sm:inline">Light</span>
					</button>
					<button
						type="button"
						onClick={() => setMode("dark")}
						className={cn(
							"flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition",
							mode === "dark"
								? "bg-background shadow-sm text-foreground"
								: "text-muted-foreground hover:text-foreground",
						)}
						title="Dark mode"
					>
						<Moon size={16} />
						<span className="hidden sm:inline">Dark</span>
					</button>
					<button
						type="button"
						onClick={() => setMode("system")}
						className={cn(
							"flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition",
							mode === "system"
								? "bg-background shadow-sm text-foreground"
								: "text-muted-foreground hover:text-foreground",
						)}
						title="System preference"
					>
						<Monitor size={16} />
						<span className="hidden sm:inline">Auto</span>
					</button>
				</div>
			</div>

			{/* Theme Cards by Category */}
			<div className="space-y-4">
				{["general", "eras-tour", "seasonal"].map((category) => {
					const themes = themesByCategory[category];
					if (!themes || themes.length === 0) return null;

					return (
						<div key={category}>
							<div className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wide">
								{categoryLabels[category]}
							</div>
							<div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-2">
								{themes.map((theme) => (
									<ThemeCard
										key={theme.value}
										theme={theme}
										isSelected={preset === theme.value}
										onSelect={() => handleSelect(theme.value)}
										onHover={() => handleHover(theme.value)}
										onHoverEnd={handleHoverEnd}
									/>
								))}
							</div>
						</div>
					);
				})}
			</div>

			{/* Preview indicator */}
			{previewTheme && previewTheme !== preset && (
				<div className="text-xs text-muted-foreground text-center py-2 px-3 bg-accent/30 rounded-lg">
					Previewing{" "}
					<span className="font-medium">
						{availableThemes.find((t) => t.value === previewTheme)?.label}
					</span>{" "}
					— click to select
				</div>
			)}
		</div>
	);
}

// Compact version for header/navbar use
export function ThemeSwitcherCompact() {
	const { preset, mode, setMode, resolvedMode } = useTheme();
	const currentColors = themeColors[preset];

	return (
		<div className="flex items-center gap-2">
			{/* Color preview dots */}
			<div className="grid grid-cols-2 gap-0.5">
				{currentColors.map((color, i) => (
					<div
						key={`${color}-${
							// biome-ignore lint/suspicious/noArrayIndexKey: not actually the only index
							i
						}`}
						className="w-2 h-2 rounded-full border border-black/10 dark:border-white/10"
						style={{ backgroundColor: color }}
					/>
				))}
			</div>

			{/* Mode toggle */}
			<button
				type="button"
				onClick={() => {
					if (mode === "light") setMode("dark");
					else if (mode === "dark") setMode("system");
					else setMode("light");
				}}
				className="p-1.5 rounded-md hover:bg-accent transition"
				title={`Current: ${mode === "system" ? `System (${resolvedMode})` : mode}`}
			>
				{resolvedMode === "dark" ? <Moon size={16} /> : <Sun size={16} />}
			</button>
		</div>
	);
}

// Sidebar version - collapsible with theme names visible when expanded
export function ThemeSwitcherSidebar() {
	const { preset, mode, setPreset, setMode } = useTheme();
	const [isExpanded, setIsExpanded] = useState(false);
	const [_previewTheme, setPreviewTheme] = useState<ThemePreset | null>(null);
	const previewTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const availableThemes = getAvailableThemes();
	const currentTheme = availableThemes.find((t) => t.value === preset);
	const currentColors = themeColors[preset];

	// Group themes by category
	const themesByCategory = availableThemes.reduce(
		(acc, theme) => {
			const category = theme.category || "general";
			if (!acc[category]) acc[category] = [];
			acc[category].push(theme);
			return acc;
		},
		{} as Record<string, typeof availableThemes>,
	);

	// Apply preview theme on hover
	const handleHover = useCallback((themeValue: ThemePreset) => {
		if (previewTimeoutRef.current) {
			clearTimeout(previewTimeoutRef.current);
		}
		setPreviewTheme(themeValue);
		const root = window.document.documentElement;
		if (themeValue === "default") {
			root.removeAttribute("data-theme");
		} else {
			root.setAttribute("data-theme", themeValue);
		}
	}, []);

	// Restore original theme on hover end
	const handleHoverEnd = useCallback(() => {
		previewTimeoutRef.current = setTimeout(() => {
			setPreviewTheme(null);
			const root = window.document.documentElement;
			if (preset === "default") {
				root.removeAttribute("data-theme");
			} else {
				root.setAttribute("data-theme", preset);
			}
		}, 100);
	}, [preset]);

	// Select and persist theme
	const handleSelect = useCallback(
		(themeValue: ThemePreset) => {
			if (previewTimeoutRef.current) {
				clearTimeout(previewTimeoutRef.current);
			}
			setPreviewTheme(null);
			setPreset(themeValue);
		},
		[setPreset],
	);

	return (
		<div className="space-y-2">
			{/* Collapsed view - click to expand */}
			<button
				type="button"
				onClick={() => setIsExpanded(!isExpanded)}
				className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-accent transition text-left"
			>
				{/* Current theme colors */}
				<div className="grid grid-cols-2 gap-0.5 shrink-0">
					{currentColors.map((color, i) => (
						<div
							key={`${color}-${
								// biome-ignore lint/suspicious/noArrayIndexKey: not using index only
								i
							}`}
							className="w-2.5 h-2.5 rounded-sm"
							style={{ backgroundColor: color }}
						/>
					))}
				</div>
				<span className="text-xs text-muted-foreground truncate flex-1">
					{currentTheme?.label || "Theme"}
				</span>
				{/* Mode indicator */}
				<div className="shrink-0 text-muted-foreground">
					{mode === "light" ? (
						<Sun size={12} />
					) : mode === "dark" ? (
						<Moon size={12} />
					) : (
						<Monitor size={12} />
					)}
				</div>
				<ChevronDown
					size={14}
					className={cn(
						"shrink-0 text-muted-foreground transition-transform",
						isExpanded && "rotate-180",
					)}
				/>
			</button>

			{/* Expanded view */}
			{isExpanded && (
				<div className="space-y-3 pt-1">
					{/* Mode Toggle */}
					<div className="flex items-center gap-1 p-0.5 bg-accent/50 rounded-md">
						<button
							type="button"
							onClick={() => setMode("light")}
							className={cn(
								"flex-1 flex items-center justify-center gap-1 p-1.5 rounded text-xs transition",
								mode === "light"
									? "bg-background shadow-sm text-foreground"
									: "text-muted-foreground hover:text-foreground",
							)}
						>
							<Sun size={12} />
							<span>Light</span>
						</button>
						<button
							type="button"
							onClick={() => setMode("dark")}
							className={cn(
								"flex-1 flex items-center justify-center gap-1 p-1.5 rounded text-xs transition",
								mode === "dark"
									? "bg-background shadow-sm text-foreground"
									: "text-muted-foreground hover:text-foreground",
							)}
						>
							<Moon size={12} />
							<span>Dark</span>
						</button>
						<button
							type="button"
							onClick={() => setMode("system")}
							className={cn(
								"flex-1 flex items-center justify-center gap-1 p-1.5 rounded text-xs transition",
								mode === "system"
									? "bg-background shadow-sm text-foreground"
									: "text-muted-foreground hover:text-foreground",
							)}
						>
							<Monitor size={12} />
							<span>Auto</span>
						</button>
					</div>

					{/* Theme list by category */}
					<div className="space-y-2 max-h-64 overflow-y-auto">
						{["general", "eras-tour", "seasonal"].map((category) => {
							const themes = themesByCategory[category];
							if (!themes || themes.length === 0) return null;

							return (
								<div key={category}>
									<div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1 px-1">
										{categoryLabels[category]}
									</div>
									<div className="space-y-0.5">
										{themes.map((theme) => {
											const colors = themeColors[theme.value];
											const isSelected = preset === theme.value;

											return (
												<button
													type="button"
													key={theme.value}
													onClick={() => handleSelect(theme.value)}
													onMouseEnter={() => handleHover(theme.value)}
													onMouseLeave={handleHoverEnd}
													className={cn(
														"w-full flex items-center gap-2 px-2 py-1.5 rounded text-left transition",
														"hover:bg-accent",
														isSelected && "bg-primary/10 ring-1 ring-primary",
													)}
												>
													<div className="grid grid-cols-2 gap-0.5 shrink-0">
														{colors.map((color, i) => (
															<div
																key={`${color}-${
																	// biome-ignore lint/suspicious/noArrayIndexKey: not using index only
																	i
																}`}
																className="w-2 h-2 rounded-sm"
																style={{ backgroundColor: color }}
															/>
														))}
													</div>
													<span className="text-xs truncate">
														{theme.label}
													</span>
													{theme.seasonal?.emoji && (
														<span className="text-xs shrink-0">
															{theme.seasonal.emoji}
														</span>
													)}
													{isSelected && (
														<Check
															size={12}
															className="ml-auto shrink-0 text-primary"
														/>
													)}
												</button>
											);
										})}
									</div>
								</div>
							);
						})}
					</div>
				</div>
			)}
		</div>
	);
}
