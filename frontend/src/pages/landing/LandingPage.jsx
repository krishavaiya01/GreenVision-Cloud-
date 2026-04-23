import React, { Suspense, useState, useEffect, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Cloud } from "@react-three/drei";
import {
  AppBar, Toolbar, Typography, Button, Box, Container, Grid, Card, CardContent, useMediaQuery, IconButton, Collapse, List, ListItem, ListItemText
} from "@mui/material";
import { styled, useTheme } from "@mui/material/styles";
import MenuIcon from "@mui/icons-material/Menu";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import logo2d from "../../assets/logo.png"; // Your 2D PNG logo
import { colors } from "../../styles/theme/colors"; // Your existing colors theme

// Custom Counter component remains the same
function Counter({ end, duration = 2000 }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let start = 0;
    const increment = end / (duration / 16);
    const timer = setInterval(() => {
      start += increment;
      if (start >= end) {
        setCount(end);
        clearInterval(timer);
      } else {
        setCount(Math.ceil(start));
      }
    }, 16);
    return () => clearInterval(timer);
  }, [end, duration]);
  return (
    <Typography variant="h3" sx={{ fontWeight: 700, color: colors.primary[900] }}>
      {count.toLocaleString()}
    </Typography>
  );
}

// Immersive 3D Background with animated clouds
const ImmersiveCloudBackground = () => (
  <Box
    sx={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      zIndex: -1,
      background: `linear-gradient(to bottom, ${colors.primary[50]} 0%, ${colors.primary[100]} 100%)`,
    }}
  >
    <Canvas camera={{ position: [0, 0, 20], fov: 75 }}>
      <Suspense fallback={null}>
        <fog attach="fog" args={[colors.primary[100], 15, 40]} />
        <ambientLight intensity={1.5} color={colors.secondary.mint.light} />
        <directionalLight position={[10, 10, 5]} intensity={0.8} color={colors.secondary.mint.main} />
        <directionalLight position={[-10, -10, -5]} intensity={0.6} color={colors.primary[600]} />
        <Cloud position={[-10, -6, -10]} speed={0.1} opacity={0.2} color={colors.neutral[100]} segments={20} bounds={[10, 2, 10]} volume={6} />
        <Cloud position={[10, 6, -15]} speed={0.15} opacity={0.15} color={colors.neutral[100]} segments={20} bounds={[10, 2, 10]} volume={5} />
        <Cloud position={[-5, 4, 0]} speed={0.12} opacity={0.25} color={colors.neutral[100]} segments={20} bounds={[10, 2, 10]} volume={7} />
        <Cloud position={[0, -2, -20]} speed={0.08} opacity={0.1} color={colors.neutral[100]} segments={20} bounds={[15, 3, 15]} volume={8} />
        <Cloud position={[-15, 8, -5]} speed={0.18} opacity={0.3} color={colors.neutral[100]} segments={20} bounds={[8, 1, 8]} volume={4} />
        <Cloud position={[8, -4, -8]} speed={0.1} opacity={0.22} color={colors.neutral[100]} segments={20} bounds={[12, 2, 12]} volume={7} />
        <Cloud position={[20, 0, -12]} speed={0.09} opacity={0.17} color={colors.neutral[100]} segments={20} bounds={[10, 2, 10]} volume={6} />
        <Cloud position={[-20, 10, -2]} speed={0.13} opacity={0.28} color={colors.neutral[100]} segments={20} bounds={[10, 2, 10]} volume={5} />
      </Suspense>
    </Canvas>
  </Box>
);

const LandingPage = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [menuOpen, setMenuOpen] = useState(false);
  
  // ✅ State to track scroll position for header effects
  const [scrolled, setScrolled] = useState(false);

  // ✅ Effect to add and remove scroll event listener
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);


  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const glassCardStyles = {
    p: { xs: 2, md: 3 },
    borderRadius: 4,
    height: "100%",
    background: 'rgba(255, 255, 255, 0.55)',
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.1)',
    transition: 'background 0.3s ease, border-color 0.3s ease, transform 0.3s ease',
    '&:hover': {
      transform: 'translateY(-8px)',
      background: 'rgba(255, 255, 255, 0.75)',
      borderColor: 'rgba(255, 255, 255, 0.5)',
    },
  };

  const features = [
    { icon: "☁️", title: "Cloud Monitoring", description: "Real-time monitoring of AWS, Azure, and GCP resources with alerts." },
    { icon: "🌱", title: "Carbon Tracking", description: "Track your cloud carbon footprint and optimize for sustainability." },
    { icon: "🤖", title: "AI Recommendations", description: "Get AI-powered insights to optimize costs and efficiency." },
    { icon: "🖥️", title: "Multi-Cloud Management", description: "Manage multiple cloud providers from a single dashboard." },
  ];
  const faqs = [
    { question: "What is GreenVision Cloud?", answer: "GreenVision Cloud optimizes cloud resources and tracks environmental impact." },
    { question: "Which providers are supported?", answer: "We support AWS, Azure, GCP, and hybrid multi-cloud environments." },
    { question: "How does AI help?", answer: "AI analyzes usage to provide cost and sustainability recommendations." },
  ];
  const testimonials = [
    { name: "John Doe, CTO", feedback: "GreenVision Cloud reduced our costs by 30% and gave real sustainability insights." },
    { name: "Jane Smith, Sustainability Lead", feedback: "The AI recommendations and carbon tracking are game changers!" },
  ];

  return (
    <Box>
      <ImmersiveCloudBackground />
      
      {/* ✅ Navbar wrapped in framer-motion for entry animation */}
      <motion.div
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        style={{ position: 'fixed', width: '100%', zIndex: 1000 }}
      >
        <AppBar 
          position="static" // Position is handled by the motion div
          elevation={0}
          sx={{
            // ✅ Dynamic background and blur effect based on scroll state
            background: scrolled ? 'rgba(255, 255, 255, 0.65)' : 'transparent',
            backdropFilter: scrolled ? 'blur(10px)' : 'none',
            borderBottom: scrolled ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid transparent',
            transition: 'background 0.4s ease, backdrop-filter 0.4s ease, border-bottom 0.4s ease',
          }}
        >
          <Toolbar sx={{ display: "flex", justifyContent: "space-between", py: 1 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
              <motion.div whileHover={{ scale: 1.05, rotate: -5 }} transition={{ type: "spring", stiffness: 300 }}>
                 {/* ✅ Updated logo style to be dark and visible on the light background */}
                <img src={logo2d} alt="GreenVision Cloud Logo" style={{ height: 50, width: "auto", display: "block", objectFit: "contain" }}/>
              </motion.div>
              <Typography variant="h6" sx={{ fontWeight: 700, color: colors.primary[900] }}>GreenVision Cloud</Typography>
            </Box>
            {isMobile ? (
              <Box>
                <IconButton sx={{ color: colors.primary[900] }} onClick={() => setMenuOpen(!menuOpen)}><MenuIcon /></IconButton>
                <Collapse in={menuOpen}>
                   {/* ✅ Mobile menu updated with glass effect */}
                  <List sx={{ ...glassCardStyles, p: 1, position: 'absolute', right: 0, top: '100%', zIndex: 10, minWidth: 150 }}>
                    <ListItem button onClick={() => navigate("/login")}><ListItemText primary="Login" sx={{ color: colors.primary[900] }} /></ListItem>
                    <ListItem button onClick={() => navigate("/register")}><ListItemText primary="Register" sx={{ color: colors.primary[900] }} /></ListItem>
                  </List>
                </Collapse>
              </Box>
            ) : (
              <Box sx={{ display: "flex", gap: 2 }}>
                {/* ✅ Buttons updated for better visibility and hover effects */}
                <Button 
                    variant="text" 
                    onClick={() => navigate("/login")} 
                    sx={{ color: colors.primary[800], fontWeight: 600, '&:hover': { bgcolor: 'rgba(0,0,0,0.05)' } }}
                >Login</Button>
                <Button 
                    variant="outlined" 
                    onClick={() => navigate("/register")} 
                    sx={{ borderColor: colors.primary[500], color: colors.primary[500], fontWeight: 600, borderRadius: 2, '&:hover': { bgcolor: colors.primary[50], borderColor: colors.primary[700] } }}
                >Register</Button>
              </Box>
            )}
          </Toolbar>
        </AppBar>
      </motion.div>

      {/* ✅ Added padding top to main content to avoid being hidden by fixed navbar */}
      <Box sx={{ minHeight: "100vh", display: "flex", flexDirection: "column", position: 'relative', background: 'transparent', pt: '80px' }}>
        {/* Hero Section */}
        <Container sx={{ flexGrow: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", color: colors.primary[900], gap: 3, py: 8 }}>
          <motion.img src={logo2d} alt="GreenVision Logo" style={{ height: 380 }} initial={{ opacity: 0, y: -50 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1 }} />

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5, duration: 1 }}>
            <Typography variant="h6" sx={{fontFamily: "'Open Sans', sans-serif", color: "black", maxWidth: 600, mx: "auto", mt: 2 }}>
              Transforming the way you monitor and optimize cloud resources while tracking environmental impact. 
              AI-powered insights, multi-cloud management, and carbon footprint tracking – all in one platform.
            </Typography>
          </motion.div>
          <Box sx={{ display: "flex", gap: 2, mt: 4, width: "100%", maxWidth: 400 }}>
            <Button variant="contained" sx={{ flex: 1, borderRadius: 2, py: 1.2, fontWeight: 600, background: colors.primary[900], "&:hover": { background: colors.primary[800] } }} onClick={() => navigate("/register")}>Get Started</Button>
            <Button variant="outlined" sx={{ flex: 1, borderColor: colors.primary[500], color: colors.primary[500], "&:hover": { borderColor: colors.primary[600], color: colors.primary[600] }, borderRadius: 2, py: 1.2, fontWeight: 600 }} onClick={() => navigate("/login")}>Login</Button>
          </Box>
        </Container>

        {/* Sections now have a transparent background to show the clouds */}
        <Box sx={{ background: 'transparent' }}>
          {/* Statistics Section */}
          <Container sx={{ py: 8 }}>
            <Grid container spacing={4} justifyContent="center">
              <Grid item xs={6} md={3} textAlign="center"><Counter end={5000} /><Typography>Active Users</Typography></Grid>
              <Grid item xs={6} md={3} textAlign="center"><Counter end={120} /><Typography>Enterprise Clients</Typography></Grid>
              <Grid item xs={6} md={3} textAlign="center"><Counter end={300} /><Typography>Projects Optimized</Typography></Grid>
              <Grid item xs={6} md={3} textAlign="center"><Counter end={99} /><Typography>% Uptime</Typography></Grid>
            </Grid>
          </Container>

          {/* Features Section */}
          <Container sx={{ py: 8 }}>
            <Typography variant="h4" sx={{ fontWeight: 700, textAlign: "center", mb: 6 }}>Our Features</Typography>
            <Grid container spacing={4} justifyContent="center" alignItems="stretch">
              {features.map((feature, index) => (
                <Grid item xs={12} sm={6} md={3} key={index} sx={{ display: "flex" }}>
                  <motion.div initial={{ opacity: 0, y: 50 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: index * 0.2 }} style={{ flex: 1 }}>
                    <Card sx={glassCardStyles}>
                      <CardContent sx={{ textAlign: 'center' }}>
                        <Typography variant="h3" sx={{ mb: 2 }}>{feature.icon}</Typography>
                        <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>{feature.title}</Typography>
                        <Typography variant="body2" sx={{ color: colors.primary[700] }}>{feature.description}</Typography>
                      </CardContent>
                    </Card>
                  </motion.div>
                </Grid>
              ))}
            </Grid>
          </Container>

          {/* FAQ Section */}
          <Container sx={{ py: 8 }}>
            <Typography variant="h4" sx={{ fontWeight: 700, textAlign: "center", mb: 6 }}>Frequently Asked Questions</Typography>
            <Grid container spacing={3} justifyContent="center">
              {faqs.map((faq, index) => (
                <Grid item xs={12} md={8} key={index}>
                  <Card sx={glassCardStyles}>
                    <Typography variant="h6" sx={{ fontWeight: 700 }}>{faq.question}</Typography>
                    <Typography variant="body2" sx={{ mt: 1, color: colors.primary[700] }}>{faq.answer}</Typography>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Container>

          {/* Testimonials Section */}
<Container sx={{ py: 8 }}>
  <Typography variant="h4" sx={{ fontWeight: 700, textAlign: "center", mb: 6 }}>
    What Our Users Say
  </Typography>
  <Grid container spacing={4} justifyContent="center" alignItems="stretch">
    {testimonials.map((t, index) => (
      <Grid item xs={12} md={6} key={index} sx={{ display: "flex" }}>
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: index * 0.3 }}
          style={{ flex: 1, display: "flex" }}
        >
          <Card
            sx={{
              ...glassCardStyles,
              flex: 1,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between", // keeps content aligned
              minHeight: 200, // ✅ uniform minimum height for all cards
            }}
          >
            <CardContent sx={{ flexGrow: 1, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <Typography variant="body1" sx={{ fontStyle: "italic", mb: 2 }}>
                "{t.feedback}"
              </Typography>
              <Typography
                variant="subtitle2"
                sx={{
                  fontWeight: 700,
                  color: colors.primary[900],
                  textAlign: "right",
                  mt: "auto", // ✅ pushes name to bottom
                }}
              >
                - {t.name}
              </Typography>
            </CardContent>
          </Card>
        </motion.div>
      </Grid>
    ))}
  </Grid>
</Container>


          {/* CTA Section */}
          <Container sx={{ py: 6, textAlign: "center" }}>
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.8 }}>
              <Typography variant="h5" sx={{ fontWeight: 700, mb: 4 }}>Ready to optimize your cloud with GreenVision Cloud?</Typography>
              <Button variant="contained" sx={{ background: colors.primary[900], "&:hover": { background: colors.primary[800] }, borderRadius: 2, px: 6, py: 1.5, fontWeight: 700 }} onClick={() => navigate("/register")}>Get Started Now</Button>
            </motion.div>
          </Container>
        </Box>

        {/* Back to Top */}
        <Box sx={{ position: "fixed", bottom: 20, right: 20 }}>
          <Button onClick={scrollToTop} sx={{ minWidth: 0, p: 1, borderRadius: "50%", background: colors.primary[900], color: "#fff", "&:hover": { background: colors.primary[800] } }}>
            <KeyboardArrowUpIcon />
          </Button>
        </Box>

        {/* Footer */}
        <Box sx={{
            py: 4,
            textAlign: "center",
            background: 'transparent',
            color: colors.primary[900],
            mt: 4,
          }}>
          <Typography variant="body2" sx={{textShadow: '0 1px 2px rgba(255,255,255,0.7)'}}>
            &copy; {new Date().getFullYear()} GreenVision Cloud. Pune, India. All rights reserved.
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};

export default LandingPage;
