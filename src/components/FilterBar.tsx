import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence, useScroll, useMotionValueEvent, useReducedMotion, Transition } from "motion/react";
import { ChevronRight, Home, SlidersHorizontal } from "lucide-react";
import { CATEGORIES } from "@/constants/categories";
import { CATEGORY_ICONS } from "@/components/icons/CategoryIcons";

interface FilterBarProps {
  activeCategory: string;
  onFilterChange: (category: string) => void;
  onOpenFilters: () => void;
  activeFiltersCount: number;
}

export default function FilterBar({ activeCategory, onFilterChange, onOpenFilters, activeFiltersCount }: FilterBarProps) {
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [activeSubCategory, setActiveSubCategory] = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { scrollY } = useScroll();
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    const nextMainCategory = CATEGORIES.find((category) => category.id === activeCategory)
      ?? CATEGORIES.find((category) => category.subcategories.some((sub) => sub.id === activeCategory))
      ?? null;

    setSelectedCategory(nextMainCategory?.id ?? "all");
    setActiveSubCategory(
      nextMainCategory && nextMainCategory.id !== activeCategory ? activeCategory : null,
    );

    if (activeCategory === "all" || !nextMainCategory) {
      setActiveSubCategory(null);
    }
  }, [activeCategory]);

  useMotionValueEvent(scrollY, "change", (latest) => {
    setIsCollapsed(latest > 80);
  });

  const handleCategoryClick = (id: string) => {
    if (isCollapsed) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    if (selectedCategory === id) {
      // Toggle off if clicking the same category
      setSelectedCategory("all");
      setActiveSubCategory(null);
      onFilterChange("all");
    } else {
      setSelectedCategory(id);
      setActiveSubCategory(null);
      onFilterChange(id);
    }
  };

  const handleSubCategoryClick = (id: string) => {
    setActiveSubCategory(id);
    onFilterChange(id);
  };

  const smoothTransition: Transition = prefersReducedMotion
    ? { duration: 0 }
    : { type: "spring", stiffness: 300, damping: 30 };

  const currentCategory = CATEGORIES.find(c => c.id === selectedCategory);

  return (
    <div
      className={cn(
        "sticky top-16 z-20 transition-all duration-300 ease-in-out",
        isCollapsed
          ? "bg-transparent py-2"
          : "bg-transparent py-3 pb-2"
      )}
    >
      <div className="container mx-auto px-1 flex flex-col gap-2">
        {/* Main Categories Row */}
        <div
          className={cn(
            "overflow-x-auto no-scrollbar flex items-center transition-all duration-300 mx-auto",
            isCollapsed
              ? "bg-surface/90 backdrop-blur-md border border-outline-variant shadow-lg rounded-full px-2 py-0.5 gap-0.5 max-w-[95vw]"
              : "w-full gap-1.5 md:gap-2 justify-start md:justify-center"
          )}
        >
          {/* Filters Button */}
          {!isCollapsed && (
            <div className="flex items-center pr-1 md:pr-3 mr-0.5 md:mr-1 shrink-0">
              <button
                onClick={onOpenFilters}
                className={cn(
                  "flex items-center justify-center gap-1 rounded-full border border-outline-variant/60 bg-surface-bright/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.75),0_8px_24px_rgba(18,28,42,0.06)] backdrop-blur-md hover:border-primary transition-all font-semibold whitespace-nowrap relative",
                  isCollapsed ? "p-1.5" : "px-2 py-1 md:px-4 md:py-2 text-[10px] md:text-xs",
                  activeFiltersCount > 0 ? "border-primary bg-primary/10" : ""
                )}
              >
                <SlidersHorizontal className={cn("w-3.5 h-3.5", !isCollapsed && "md:w-3.5 md:h-3.5")} />
                <span className="hidden md:inline">Filters</span>
                {activeFiltersCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-[#08a8c8] text-white text-[9px] rounded-full flex items-center justify-center border border-surface">
                    {activeFiltersCount}
                  </span>
                )}
              </button>
            </div>
          )}

          <button
            onClick={() => { setSelectedCategory("all"); setActiveSubCategory(null); onFilterChange("all"); }}
            className={cn(
              "flex flex-col items-center cursor-pointer rounded-full relative shrink-0 transition-all duration-150 backdrop-blur-md",
              isCollapsed ? "min-w-[35px] p-1" : "min-w-[50px] md:min-w-[64px] p-1 md:p-2 gap-0.5 md:gap-2",
            selectedCategory === "all" ? "text-primary" : "text-on-surface-variant hover:text-on-surface"
          )}
        >
            {selectedCategory === "all" && (
              <motion.div
                layoutId="activeFilter"
                className={cn(
                  "absolute inset-0 rounded-full",
                  isCollapsed ? "bg-primary/10" : "bg-surface-bright/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_8px_20px_rgba(8,168,200,0.14)] ring-1 ring-primary/15"
                )}
                transition={smoothTransition}
              />
            )}
            <Home className={cn("relative z-10", isCollapsed ? "w-4 h-4" : "w-5 h-5 md:w-7 md:h-7")} />
            {!isCollapsed && (
              <span className="text-[9px] md:text-[11px] font-semibold whitespace-nowrap relative z-10">All</span>
            )}
          </button>

          {CATEGORIES.map((category) => {
            const IconComponent = CATEGORY_ICONS[category.id];
            return (
              <button
                key={category.id}
                onClick={() => handleCategoryClick(category.id)}
                className={cn(
                  "flex flex-col items-center cursor-pointer rounded-full relative shrink-0 transition-all duration-200 group backdrop-blur-md",
                  isCollapsed ? "min-w-[35px] p-1" : "min-w-[50px] md:min-w-[72px] p-1 md:p-2 gap-0.5 md:gap-2",
                selectedCategory === category.id
                    ? "text-primary"
                    : "text-on-surface-variant hover:text-on-surface"
                )}
              >
                {selectedCategory === category.id && (
                  <motion.div
                    layoutId="activeFilter"
                    className={cn(
                      "absolute inset-0 rounded-full",
                      isCollapsed
                        ? "bg-primary/10"
                        : "bg-surface-bright/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_8px_20px_rgba(8,168,200,0.14)] ring-1 ring-primary/15"
                    )}
                    transition={smoothTransition}
                  />
                )}

                {IconComponent ? (
                  <IconComponent
                    className={cn(
                      "relative z-10 transition-transform duration-200 group-hover:scale-110",
                      isCollapsed ? "w-4 h-4" : "w-5 h-5 md:w-8 md:h-8"
                    )}
                  />
                ) : (
                  <span
                    className={cn(
                      "relative z-10 transition-transform duration-200 group-hover:scale-110",
                      isCollapsed ? "text-sm" : "text-lg md:text-2xl"
                    )}
                  >
                    {category.label[0]}
                  </span>
                )}

                {!isCollapsed && (
                  <span className="text-[9px] md:text-[11px] font-semibold whitespace-nowrap relative z-10 text-center">
                    {category.label}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Subcategories Row - Animated Presence */}
        <AnimatePresence mode="wait">
          {currentCategory && !isCollapsed && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex items-center justify-start md:justify-center gap-2 overflow-x-auto no-scrollbar py-2 border-t border-outline-variant mt-1"
            >
              <div className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 rounded-full border border-blue-200 shrink-0">
                <span className="text-[10px] uppercase tracking-wider font-bold text-blue-600">Explore</span>
                <ChevronRight className="w-3 h-3 text-blue-600/60" />
              </div>
              <div className="flex items-center gap-2">
                {currentCategory.subcategories.map((sub) => (
                  <button
                    key={sub.id}
                    onClick={() => handleSubCategoryClick(sub.id)}
                    className={cn(
                      "px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all border",
                      activeSubCategory === sub.id
                        ? "bg-[#08a8c8] text-white border-transparent shadow-[#08a8c8]/20"
                        : "bg-surface text-on-surface-variant border-outline-variant hover:border-blue-600/50 hover:text-blue-600"
                    )}
                  >
                    {sub.label}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
