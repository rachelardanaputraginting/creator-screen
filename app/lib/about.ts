export interface AboutData {
  name: string;
  role: string;
  bio: string;
  link: string;
}

export const STORAGE_KEY = "creator-screen-about";

export const DEFAULT_ABOUT: AboutData = {
  name: "Nama Kamu",
  role: "Software Engineer",
  bio: "Halo! Saya membuat konten coding dan tutorial.",
  link: "@username",
};

export function readAbout(): AboutData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AboutData>;
      return { ...DEFAULT_ABOUT, ...parsed };
    }
  } catch {
    /* keep defaults */
  }
  return { ...DEFAULT_ABOUT };
}
