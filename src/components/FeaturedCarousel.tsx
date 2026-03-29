import * as React from "react";
import { Listing } from "@/types";
import PropertyCard from "./PropertyCard";
import {
    Carousel,
    CarouselContent,
    CarouselItem,
    CarouselNext,
    CarouselPrevious,
} from "@/components/ui/carousel";
import Autoplay, { type AutoplayType } from "embla-carousel-autoplay";

interface FeaturedCarouselProps {
    listings: Listing[];
    onListingClick: (listing: Listing) => void;
}

export default function FeaturedCarousel({ listings, onListingClick }: FeaturedCarouselProps) {
    const autoplayPlugin = React.useRef<AutoplayType>(
        Autoplay({ delay: 2000, stopOnInteraction: false, stopOnMouseEnter: true })
    );

    if (listings.length === 0) return null;

    return (
        <section className="w-full bg-[#FAFAFA] py-16 mb-16 border-y border-outline-variant overflow-visible">
            <div className="container mx-auto px-4 mb-10">
                <div className="flex items-end justify-between">
                    <div>
                        <h2 className="text-3xl font-bold text-on-surface tracking-tight font-primary">Featured Stays</h2>
                    </div>
                </div>
            </div>

            <div className="w-full relative px-4">
                <Carousel
                    opts={{
                        align: "start",
                        loop: true,
                    }}
                    plugins={[autoplayPlugin.current]}
                    className="w-full max-w-[1400px] mx-auto overflow-visible"
                >
                    <CarouselContent className="-ml-6">
                        {listings.map((listing) => (
                            <CarouselItem key={listing.id} className="pl-6 basis-full sm:basis-1/2 md:basis-1/2 lg:basis-1/3 xl:basis-1/4">
                                <div className="p-1 h-full">
                                    <div className="transition-all duration-500 hover:-translate-y-3 hover:shadow-2xl hover:shadow-gray-200 rounded-2xl h-full">
                                        <PropertyCard listing={listing} onClick={onListingClick} showBorder={true} />
                                    </div>
                                </div>
                            </CarouselItem>
                        ))}
                    </CarouselContent>
                    <div className="flex justify-end gap-3 mt-8 md:absolute md:-top-20 md:right-0">
                        <CarouselPrevious className="static translate-y-0 h-12 w-12 border-outline-variant hover:bg-surface-dim hover:text-white transition-all shadow-md" />
                        <CarouselNext className="static translate-y-0 h-12 w-12 border-outline-variant hover:bg-surface-dim hover:text-white transition-all shadow-md" />
                    </div>
                </Carousel>
            </div>
        </section>
    );
}
