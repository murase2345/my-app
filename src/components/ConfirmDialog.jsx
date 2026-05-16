import Modal from "./Modal.jsx";

export default function ConfirmDialog({
  open,
  onClose,
  title = "確認",
  message,
  okText = "OK",
  cancelText = "キャンセル",
  onOk,
  danger = false
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <div className="row" style={{ justifyContent: "space-between" }}>
          <button className="btn" onClick={onClose}>
            {cancelText}
          </button>
          <button
            className={`btn ${danger ? "btn-danger" : "btn-primary"}`}
            onClick={() => {
              onOk?.();
              onClose?.();
            }}
          >
            {okText}
          </button>
        </div>
      }
    >
      <div className="grid" style={{ gap: 10 }}>
        <div>{message}</div>
        <div className="smallnote">※誤操作防止のため確認しています。</div>
      </div>
    </Modal>
  );
}

