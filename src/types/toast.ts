/** 안내 문구 옆에 붙는 바로가기 버튼 */
export interface ToastAction {
  label: string;
  onClick: () => void;
}

export type ShowToast = (msg: string, action?: ToastAction) => void;
