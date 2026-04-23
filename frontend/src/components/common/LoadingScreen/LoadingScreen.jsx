// src/components/common/LoadingScreen/LoadingScreen.jsx
import React from "react";
import loaderGif from "../../../assets/loader.gif"; 

export default function LoadingScreen() {
  return (
    <div style={{
      width: "100vw",
      height: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center"
    }}>
      <img src={loaderGif} alt="Loading" style={{ width: "250px" }} />
    </div>
  );
}
