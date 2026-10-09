/** Nội dung thông báo consent (version v1). UI render từ đây; submit phải gửi đúng version. */
export const CONSENT_VERSION = "v1";

export const CONSENT_SECTIONS: Array<{ title: string; body: string }> = [
  {
    title: "Mục đích",
    body: "Dữ liệu khuôn mặt chỉ dùng để xác minh danh tính khi chấm công vào/ra. Không dùng để suy luận cảm xúc, sức khỏe, sắc tộc hay thuộc tính khác.",
  },
  {
    title: "Loại dữ liệu",
    body: "Hệ thống tạo mẫu tham chiếu khuôn mặt (face template reference) qua provider và lưu mã tham chiếu + điểm chất lượng. Mặc định KHÔNG lưu ảnh camera thô.",
  },
  {
    title: "Lưu trữ & xóa",
    body: "Ảnh chụp tạm bị xóa ngay sau xử lý. Mẫu tham chiếu bị thu hồi trong 72 giờ khi bạn rút đồng ý, nghỉ việc, hoặc theo yêu cầu. Chi tiết: BIOMETRIC_DATA_POLICY.",
  },
  {
    title: "Ai được xem",
    body: "Bạn xem trạng thái của mình. HR xác minh và kích hoạt. Quản lý trực tiếp KHÔNG xem được dữ liệu khuôn mặt. Mọi truy cập/duyệt đều ghi audit log.",
  },
  {
    title: "Phương án thay thế",
    body: "Khi camera, mạng hoặc nhận diện không hoạt động, bạn có thể chấm công bằng phương thức thay thế (PIN/mã một lần) và yêu cầu HR xác nhận.",
  },
];
