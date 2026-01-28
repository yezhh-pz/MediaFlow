from playwright.async_api import async_playwright, Browser, Page
import asyncio
import os
import random
import json
from playwright.async_api import async_playwright, Browser, BrowserContext, Page
from loguru import logger
from typing import Optional, List, Dict
import urllib.parse
from src.services.utils.user_agents import get_random_user_agent

class BrowserService:
    _instance = None
    _browser: Optional[Browser] = None
    _playwright = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(BrowserService, cls).__new__(cls)
        return cls._instance

    async def start(self):
        """Start the browser with stealth settings."""
        if self._browser is None:
            logger.info("[BrowserService] Starting Playwright with Stealth Mode...")
            self._playwright = await async_playwright().start()
            
            # Stealth Args
            args = [
                '--disable-blink-features=AutomationControlled',
                '--disable-dev-shm-usage',
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-web-security',
                '--disable-features=IsolateOrigins,site-per-process',
                '--disable-infobars',
                '--window-position=0,0',
                '--ignore-certificate-errors',
                '--disable-renderer-backgrounding',
            ]
            
            self._browser = await self._playwright.chromium.launch(
                headless=True,
                args=args
            )
            logger.info("[BrowserService] Stealth Browser started.")

    async def stop(self):
        if self._browser:
            await self._browser.close()
            self._browser = None
        if self._playwright:
            await self._playwright.stop()
            self._playwright = None
        logger.info("[BrowserService] Browser stopped.")

    async def _create_stealth_context(self, user_agent: str = None) -> BrowserContext:
        """Create a browser context with advanced stealth configurations."""
        if not self._browser:
            await self.start()

        # 1. Randomize Viewport
        viewports = [
            {"width": 1920, "height": 1080},
            {"width": 1366, "height": 768},
            {"width": 1536, "height": 864},
            {"width": 1440, "height": 900},
            {"width": 2560, "height": 1440},
        ]
        viewport = random.choice(viewports)
        
        # 2. Select User Agent
        if not user_agent:
            user_agent = get_random_user_agent()
            
        context = await self._browser.new_context(
            user_agent=user_agent,
            viewport=viewport,
            locale='zh-CN',
            timezone_id='Asia/Shanghai',
            permissions=['geolocation'],
            geolocation={'latitude': 39.9042, 'longitude': 116.4074}, # Beijing
            device_scale_factor=random.choice([1, 1.25, 1.5, 2]),
            has_touch=random.choice([True, False]),
            is_mobile=random.choice([True, False])
        )
        
        # 3. Inject Stealth Scripts (Mask WebDriver)
        await context.add_init_script("""
            // Mask WebDriver
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            
            // Mask Chrome Code
            window.chrome = { runtime: {} };
            
            // Mock Plugins
            Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
            
            // Canvas Noise
            const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
            HTMLCanvasElement.prototype.toDataURL = function(type) {
                const context = this.getContext('2d');
                if (context) {
                    const shift = Math.floor(Math.random() * 10) - 5;
                    // Draw a tiny invisible pixel with random color shift
                    context.fillStyle = 'rgba(' + shift + ',' + shift + ',' + shift + ',0.01)';
                    context.fillRect(0, 0, 2, 2);
                }
                return originalToDataURL.apply(this, arguments);
            };
        """)
        
        # 4. Add Headers
        # If Chrome, add sec-ch-ua headers (simplified)
        if 'Chrome' in user_agent:
            headers = {
                'sec-ch-ua': '"Google Chrome";v="125", "Chromium";v="125", "Not.A/Brand";v="24"',
                'sec-ch-ua-mobile': '?1' if 'Mobile' in user_agent else '?0',
                'sec-ch-ua-platform': '"Android"' if 'Android' in user_agent else '"Windows"',
                'Upgrade-Insecure-Requests': '1',
                'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            }
            await context.set_extra_http_headers(headers)
            
        return context

    async def get_page_info(self, url: str, custom_js: str = None, user_agent: str = None, timeout: int = 15) -> dict:
        """
        Navigate to a URL and extract information using custom JavaScript.
        Uses stealth context.
        """
        context = await self._create_stealth_context(user_agent)
        page = await context.new_page()
        
        result = {}
        try:
            logger.info(f"[BrowserService] Inspecting page info: {url} (UA: {user_agent[:30]}...)")
            
            # Anti-detection: Random mouse movements
            await page.mouse.move(random.randint(0, 500), random.randint(0, 500))
            
            try:
                await page.goto(url, timeout=timeout*1000, wait_until="commit")
                # Random delay
                await  asyncio.sleep(random.uniform(1.0, 3.0))
                await page.wait_for_load_state("networkidle", timeout=10000)
            except Exception as e:
                logger.warning(f"[BrowserService] Navigation warning: {e}")

            if custom_js:
                js_result = await page.evaluate(custom_js)
                if isinstance(js_result, dict):
                    result = js_result
                    logger.info(f"[BrowserService] Page Info extracted: {result}")
            else:
                result = {"title": await page.title(), "content": await page.content()}
                
        except Exception as e:
            logger.error(f"[BrowserService] get_page_info failed: {e}")
            result = {"error": str(e)}
        finally:
            await context.close()
            
        return result

    async def sniff(self, url: str, timeout: int = 15, custom_js: str = None) -> Optional[dict]:
        """
        Sniff network traffic to find video URLs.
        Uses stealth context.
        """
        found_url = None
        extracted_title = "Video" # Default title
        context = await self._create_stealth_context() # Stealth context
        page = await context.new_page()

        async def handle_request_wrapper(route, request):
            nonlocal found_url
            r_url = request.url
            # Kuaishou specific patterns (make generic later if needed)
            if '.mp4' in r_url or 'video_id=' in r_url or 'aweme/v1/play' in r_url:
                if ".html" not in r_url and "blob:" not in r_url:
                    if len(r_url) > 50:
                        found_url = r_url
                        logger.info(f"[BrowserService] Sniffed candidate: {r_url[:100]}...")
                        await route.abort() # Save bandwidth
            elif '.m3u8' in r_url:
                found_url = r_url
                logger.info(f"[BrowserService] Sniffed candidate: {r_url[:100]}...")
                await route.abort()
            else:
                 await route.continue_()

        await page.route("**/*", handle_request_wrapper)
        
        try:
            logger.info(f"[BrowserService] Navigating to {url}...")
            await page.goto(url, wait_until="domcontentloaded", timeout=timeout * 1000)
            
            # Try to extract title immediately or after a short wait
            try:
                extracted_title = await page.title()
                # Basic cleanup for Douyin title "Content - 抖音..."
                if "- 抖音" in extracted_title:
                    extracted_title = extracted_title.split("- 抖音")[0].strip()
            except: 
                pass

            custom_title_found = False
            post_url_found_steps = 0
            
            for step in range(timeout * 2):
                # If we have both, we are golden
                if found_url and custom_title_found:
                    break
                
                # If we have URL but title is taking too long/failing, just give up on title
                if found_url:
                    post_url_found_steps += 1
                    if post_url_found_steps > 10: # Wait max ~5s after finding URL for debug dump
                        logger.info("[BrowserService] Title extraction timed out, proceeding with URL only.")
                        # Force a final dump for debugging
                        if custom_js:
                            try:
                                js_result = await page.evaluate(custom_js)
                                if js_result and isinstance(js_result, dict) and js_result.get("body_preview"):
                                    logger.info(f"[BrowserService] FINAL Page Text Dump: {js_result.get('body_preview')}")
                            except Exception as e:
                                logger.warning(f"Final dump failed: {e}")
                        break

                await page.wait_for_timeout(500)
                
                # Execute custom JS repeatedly until we get a good title
                if custom_js and not custom_title_found:
                    try:
                        js_result = await page.evaluate(custom_js)
                        if js_result and isinstance(js_result, dict):
                            t = js_result.get("title")
                            # logger.info(f"[BrowserService] Sniffed Title candidate: '{t}'")
                            if t and t != "Douyin Video" and "快手" not in t: 
                                extracted_title = t
                                custom_title_found = True
                                logger.success(f"[BrowserService] Custom title locked: {extracted_title}")
                            elif not t and js_result.get("body_preview"):
                                logger.info(f"[BrowserService] Page Text Dump: {js_result.get('body_preview')}")
                    except Exception: pass

                # Try to play to trigger request (Interaction is crucial for Desktop UA)
                if step % 4 == 2:
                     try:
                        # 1. Try HTML5 Video API (Muted autoplay is usually allowed)
                        await page.evaluate("""
                            const v = document.querySelector('video');
                            if (v) { 
                                v.muted = true; 
                                v.play().catch(e => console.log("Play failed:", e)); 
                            }
                        """)
                        
                        # 2. Simulate User Interaction (Click center)
                        if viewport:
                             await page.mouse.click(viewport['width'] / 2, viewport['height'] / 2)
                             
                        # 3. Generic click
                        await page.evaluate("document.body.click()")
                     except: pass
            
            # Loop finished
            if found_url:
                logger.success(f"[BrowserService] Sniffing success. Title: {extracted_title}")
                return {"url": found_url, "title": extracted_title}
            else:
                logger.warning(f"[BrowserService] Sniffing timed out or nothing found.")

        except Exception as e:
            logger.error(f"[BrowserService] Error sniffing: {e}")
        finally:
            await context.close()
        
        return None

# Singleton instance
browser_service = BrowserService()
