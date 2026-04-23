import { useThemeContext } from "../context/ThemeContext";

export const useTheme = () => {
  const { mode, toggleTheme } = useThemeContext();

  return {
    isDarkMode: mode === "dark",
    toggleTheme,
  };
};
