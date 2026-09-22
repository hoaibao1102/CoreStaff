import { useState, useEffect, useRef } from "react";
import { MapPin, Loader2, Search, X, Clock } from "lucide-react";
import { Input } from "../input";
import { cn } from "cn";

export interface SelectedLocation {
  address: string;
  latitude: number;
  longitude: number;
}

interface PhotonFeature {
  geometry: {
    coordinates: [number, number]; // [lon, lat]
  };
  properties: {
    name?: string;
    street?: string;
    housenumber?: string;
    district?: string;
    locality?: string;
    city?: string;
    state?: string;
    country?: string;
    postcode?: string;
  };
}

interface PhotonResponse {
  features?: PhotonFeature[];
}

interface AddressAutocompleteProps {
  value: string;
  onChange: (address: string) => void;
  onSelectLocation: (location: SelectedLocation) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
}

export function AddressAutocomplete({
  value,
  onChange,
  onSelectLocation,
  placeholder = "Nhập địa chỉ để tìm kiếm và lấy tọa độ GPS...",
  disabled = false,
  className,
  id,
}: AddressAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<PhotonFeature[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [justSelected, setJustSelected] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Default coordinate bias for Vietnam (TP.HCM center)
  const [userCoords, setUserCoords] = useState<{ lat: number; lon: number }>({
    lat: 10.7769,
    lon: 106.7009,
  });

  // Try to get user current location for smarter local search results
  useEffect(() => {
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserCoords({
            lat: pos.coords.latitude,
            lon: pos.coords.longitude,
          });
        },
        () => {
          // fallback to default TP.HCM bias
        },
        { timeout: 3000 }
      );
    }
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Search via Photon (OpenStreetMap data with Vietnam location bias & CORS allowed)
  useEffect(() => {
    if (justSelected) {
      setJustSelected(false);
      return;
    }

    const query = value?.trim();
    if (!query || query.length < 2) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(
          query
        )}&lat=${userCoords.lat}&lon=${userCoords.lon}&limit=8`;

        const response = await fetch(url, {
          signal: controller.signal,
        });

        if (response.ok) {
          const data: PhotonResponse = await response.json();
          const items = (data.features || []).filter(
            (f) => f.geometry?.coordinates?.length === 2
          );
          setSuggestions(items);
          setIsOpen(items.length > 0);
        }
      } catch (err: unknown) {
        if ((err as Error)?.name !== "AbortError") {
          setSuggestions([]);
        }
      } finally {
        setLoading(false);
      }
    }, 280);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [value, justSelected, userCoords]);

  const handleSelect = (feature: PhotonFeature) => {
    const lon = Number(feature.geometry.coordinates[0].toFixed(6));
    const lat = Number(feature.geometry.coordinates[1].toFixed(6));
    const p = feature.properties;

    // Format street part
    const streetPart = p.street
      ? p.housenumber
        ? `${p.housenumber} ${p.street}`
        : p.street
      : null;

    // Compose a clean full address without duplicates
    const parts: string[] = [];
    if (p.name) parts.push(p.name);
    if (streetPart && !parts.includes(streetPart)) parts.push(streetPart);
    if (p.locality && !parts.includes(p.locality)) parts.push(p.locality);
    if (p.district && !parts.includes(p.district)) parts.push(p.district);
    if (p.city && !parts.includes(p.city)) parts.push(p.city);
    else if (p.state && !parts.includes(p.state)) parts.push(p.state);

    const formattedAddress = parts.length > 0 ? parts.join(", ") : value;

    setJustSelected(true);
    setIsOpen(false);
    onChange(formattedAddress);
    onSelectLocation({
      address: formattedAddress,
      latitude: lat,
      longitude: lon,
    });
  };

  const getPrimaryName = (feature: PhotonFeature) => {
    const p = feature.properties;
    if (p.name) return p.name;
    if (p.street) {
      return p.housenumber ? `${p.housenumber} ${p.street}` : p.street;
    }
    return p.city || p.state || "Địa điểm trên bản đồ";
  };

  const getSecondaryAddress = (feature: PhotonFeature) => {
    const p = feature.properties;
    const parts: string[] = [];
    if (p.street && p.name && p.name !== p.street) {
      parts.push(p.housenumber ? `${p.housenumber} ${p.street}` : p.street);
    }
    if (p.district) parts.push(p.district);
    if (p.city) parts.push(p.city);
    else if (p.state) parts.push(p.state);
    if (p.country) parts.push(p.country);

    return parts.length > 0 ? parts.join(", ") : "Việt Nam";
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative flex items-center">
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => {
            if (suggestions.length > 0) setIsOpen(true);
          }}
          placeholder={placeholder}
          disabled={disabled}
          className={cn("pr-10", className)}
          autoComplete="off"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
          {loading ? (
            <Loader2 className="size-4 animate-spin text-primary" />
          ) : value ? (
            <button
              type="button"
              className="pointer-events-auto text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded-sm"
              onClick={() => {
                onChange("");
                setSuggestions([]);
                setIsOpen(false);
              }}
              title="Xóa địa chỉ"
            >
              <X className="size-4" />
            </button>
          ) : (
            <Search className="size-4 pointer-events-none opacity-60" />
          )}
        </div>
      </div>

      {/* Suggestion Dropdown - Google Maps Style */}
      {isOpen && suggestions.length > 0 && (
        <div className="absolute z-50 left-0 right-0 mt-1.5 rounded-2xl border border-border bg-card shadow-2xl overflow-hidden py-1 animate-in fade-in-50 zoom-in-95 duration-100">
          <div className="px-3.5 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider border-b border-border/50 flex items-center justify-between bg-muted/40">
            <span>Gợi ý địa chỉ từ bản đồ</span>
            <span className="text-[10px] lowercase text-primary font-normal">
              Click để tự động điền GPS
            </span>
          </div>
          <ul className="max-h-72 overflow-y-auto divide-y divide-border/30">
            {suggestions.map((item, idx) => (
              <li key={`${item.properties.name}-${idx}`}>
                <button
                  type="button"
                  onClick={() => handleSelect(item)}
                  className="w-full text-left px-3.5 py-2.5 hover:bg-muted/70 flex items-start gap-3 transition-colors group cursor-pointer"
                >
                  <div className="p-1.5 rounded-full bg-muted group-hover:bg-primary/10 text-muted-foreground group-hover:text-primary transition-colors shrink-0 mt-0.5">
                    <MapPin className="size-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                      {getPrimaryName(item)}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                      {getSecondaryAddress(item)}
                    </p>
                  </div>
                  <span className="shrink-0 text-[10px] font-mono text-muted-foreground/60 bg-muted/70 px-1.5 py-0.5 rounded self-center">
                    {item.geometry.coordinates[1].toFixed(3)},{" "}
                    {item.geometry.coordinates[0].toFixed(3)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
