import { createFileRoute } from "@tanstack/react-router";
import { MapScreen } from "@/components/MapScreen";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Tether · Live Location Sharing Map" },
      {
        name: "description",
        content:
          "See your group on one live map. Share your GPS location in real time and join friends with a simple group code.",
      },
      { property: "og:title", content: "Tether · Live Location Sharing Map" },
      {
        property: "og:description",
        content: "Share your live GPS location and see your group on one map. Join with a code.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MapScreen,
});
