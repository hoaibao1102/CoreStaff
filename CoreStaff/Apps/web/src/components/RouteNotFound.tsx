import { Button } from './button';

interface RouteNotFoundProps {
  /** Where the "back" button goes: the role's default landing page. */
  homePath: string;
}

/**
 * Shown for any path the signed-in role cannot reach or that does not exist.
 * It deliberately says nothing about which of the two it is, so it does not
 * reveal which HR/manager routes exist.
 */
export function RouteNotFound({ homePath }: RouteNotFoundProps) {
  const goHome = () => {
    window.history.replaceState({}, '', homePath);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };
  return (
    <section className="mx-auto flex w-full max-w-xl flex-col items-center gap-4 px-4 py-24 text-center" role="alert">
      <p className="text-5xl font-semibold text-muted-foreground">404</p>
      <h1 className="text-xl font-semibold text-foreground">Không tìm thấy trang</h1>
      <p className="text-sm text-muted-foreground">
        Trang bạn mở không tồn tại hoặc tài khoản của bạn không có quyền truy cập.
      </p>
      <Button onClick={goHome}>Về trang chính</Button>
    </section>
  );
}
