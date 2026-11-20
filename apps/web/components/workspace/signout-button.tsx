"use client";

import { triggerAuthTransition } from "../auth-transition-overlay";
import { WorkspaceIcon } from "./icon";

export function SignOutButton({
  action,
  title,
}: {
  action: () => void | Promise<void>;
  title: string;
}) {
  return (
    <form
      action={action}
      className="work-user-signout"
      onSubmit={() => {
        triggerAuthTransition("signout");
      }}
    >
      <button
        type="submit"
        className="work-icon-btn"
        title={title}
        aria-label={title}
      >
        <WorkspaceIcon name="logout" />
      </button>
    </form>
  );
}
