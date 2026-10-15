import { SHOW_FACE_DEMO_BANNER } from "@/config/app";
import { Icon } from "./icon";

/** Nhãn bắt buộc trên mọi UI dùng mock provider. */
export function DemoBanner() {
  if (!SHOW_FACE_DEMO_BANNER) return null;
  return (
    <p
      role="note"
      className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800"
    >
      <Icon name="flag" size={14} /> DEMO – nhận diện mô phỏng, không dùng chấm công thật.
    </p>
  );
}
