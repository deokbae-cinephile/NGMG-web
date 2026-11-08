/** 내용이 올 자리를 미리 잡아 두는 회색 줄. 불러온 뒤 화면이 밀리지 않게 합니다. */
export const SkeletonRows = ({ count = 4 }: { count?: number }) => (
  <div role="status" className="flex flex-col">
    <span className="sr-only">불러오는 중입니다.</span>
    {Array.from({ length: count }, (_, index) => (
      <div key={index} aria-hidden="true" className="panel flex flex-col gap-2">
        <span className="skeleton h-3.5 w-24" />
        <span className="skeleton h-5 w-3/5" />
        <span className="skeleton h-3.5 w-4/5" />
      </div>
    ))}
  </div>
);

/** 화면 코드나 데이터를 받는 동안 보여 주는 칸. 머리 높이와 화면 높이를 실제 화면과 같게 둡니다. */
export const PageSkeleton = () => (
  <div className="skeleton-page">
    <div aria-hidden="true" className="cell-head">
      <span className="skeleton h-6 w-28" />
    </div>
    <div className="cell-body">
      <SkeletonRows count={5} />
    </div>
  </div>
);
