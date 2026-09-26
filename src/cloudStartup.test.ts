import { beforeEach, describe, expect, it } from "vitest";
import { clearCloudStartup, readCloudStartup, writeCloudStartup } from "./cloudStartup";
import type { CloudLibrary, CloudUser } from "./cloudApi";

const user: CloudUser = { id: "user-1", name: "Ada", email: "ada@example.test" };
const libraries: CloudLibrary[] = [{ id: "library-1", name: "Ada's family", role: "owner", revision: 3, owner_email: user.email }];

describe("cloud startup metadata", () => {
  beforeEach(() => localStorage.clear());

  it("remembers the last account and selected library without storing library content", () => {
    writeCloudStartup(user, libraries, libraries[0].id);
    expect(readCloudStartup()).toEqual({ user, libraries, libraryId: libraries[0].id });
    expect(localStorage.getItem("kinforge-cloud-startup-v1")).not.toContain("people");
  });

  it("falls back to the first library if the selected library no longer exists", () => {
    writeCloudStartup(user, libraries, "removed-library");
    expect(readCloudStartup()?.libraryId).toBe(libraries[0].id);
  });

  it("clears metadata on sign out", () => {
    writeCloudStartup(user, libraries, libraries[0].id);
    clearCloudStartup();
    expect(readCloudStartup()).toBeNull();
  });
});
