/* =========================================================
   MOBILE DETECTION
========================================================= */

(function () {
  const isMobile =
      window.innerWidth < 768 ||
      /Android|iPhone|iPad/i.test(navigator.userAgent);

  window.__IS_MOBILE__ = isMobile;

  if (isMobile) {
      const canvas = document.getElementById("elevator3D");

      if (canvas) {
          canvas.style.display = "none";
      }

      const poster = document.getElementById("heroPoster");

      if (poster) {
          poster.style.display = "block";
      }
  }
})();


/* =========================================================
 SMOOTH SCROLL
========================================================= */

function scrollToId(id) {
  document
      .getElementById(id)
      .scrollIntoView({
          behavior: "smooth"
      });
}


/* =========================================================
 BOOKING DATA
========================================================= */

const booking = {
  serviceType: null,
  preferredDate: null,
  preferredTime: null,
  clientContact: ""
};


/* =========================================================
 SELECT SERVICE
========================================================= */

function selectService(el, value) {
  document
      .querySelectorAll(".s-card")
      .forEach(card => {
          card.classList.remove("selected");
      });

  el.classList.add("selected");

  booking.serviceType = value;

  document.getElementById("err1").innerText = "";

  if (navigator.vibrate) {
      navigator.vibrate(20);
  }
}


/* =========================================================
 BOOKING STEPS
========================================================= */

function goStep(step) {

  /* -----------------------------------------------------
     STEP 2 — SERVICE VALIDATION
  ----------------------------------------------------- */

  if (step === 2 && !booking.serviceType) {
      document.getElementById("err1").innerText =
          "⚠️ لطفا یک خدمت را انتخاب کنید";

      return;
  }


  /* -----------------------------------------------------
     STEP 3 — FORM VALIDATION
  ----------------------------------------------------- */

  if (step === 3) {
      const name = document.getElementById("bname").value.trim();
      const phone = toEn(document.getElementById("phone").value.trim());
      const fail = msg => { document.getElementById("err2").innerText = "⚠️ " + msg; };

      if (name.length < 3) return fail("نام و نام‌خانوادگی را وارد کنید");
      if (!booking.preferredDate) return fail("تاریخ را انتخاب کنید");
      if (!booking.preferredTime) return fail("ساعت را انتخاب کنید");
      if (!/^09\d{9}$/.test(phone)) return fail("شماره موبایل معتبر وارد کنید (09xxxxxxxxx)");

      document.getElementById("err2").innerText = "";
      booking.clientName = name;
      booking.clientContact = phone;
      booking.notes = document.getElementById("bnote").value.trim();

      submitBooking();
  }


  /* -----------------------------------------------------
     UPDATE STEP UI
  ----------------------------------------------------- */

  document
      .querySelectorAll(".wstep")
      .forEach(stepElement => {
          stepElement.classList.remove("active");
      });

  document
      .getElementById(`step${step}`)
      .classList.add("active");


  /* -----------------------------------------------------
     UPDATE PROGRESS DOTS
  ----------------------------------------------------- */

  document
      .querySelectorAll(".dot")
      .forEach((dot, index) => {
          dot.classList.toggle(
              "active",
              index < step
          );
      });


  /* -----------------------------------------------------
     UPDATE PROGRESS BAR
  ----------------------------------------------------- */

  document.getElementById("progressBar").style.width =
      `${step * 33.3}%`;
}


/* =========================================================
 SUBMIT BOOKING
========================================================= */

/* Persian/Arabic digits -> Latin, and back */
function toEn(s) {
  return s.replace(/[۰-۹]/g, d => "۰۱۲۳۴۵۶۷۸۹".indexOf(d)).replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d));
}

function faDigits(s) {
  return String(s).replace(/\d/g, c => "۰۱۲۳۴۵۶۷۸۹"[c]);
}

/* Sends the booking to the owner's inbox (mailer.js); on failure returns to step 2 with the error */
async function submitBooking() {

  document.getElementById("processing").style.display = "block";
  document.getElementById("success").style.display = "none";

  try {
      await sendMail("درخواست جدید سرویس آسانسور | ویرا", {
          "نام و نام‌خانوادگی": booking.clientName,
          "موبایل": booking.clientContact,
          "نوع خدمت": booking.serviceType,
          "تاریخ": booking.dateLabel,
          "ساعت": faDigits(booking.preferredTime),
          "توضیحات": booking.notes || "—"
      });
  } catch (error) {
      goStep(2);
      document.getElementById("err2").innerText = "⚠️ " + error.message;
      return;
  }

  document.getElementById("processing").style.display = "none";
  document.getElementById("success").style.display = "block";
  document.getElementById("summary").innerText =
      `${booking.serviceType} | ${booking.dateLabel} ساعت ${faDigits(booking.preferredTime)}`;
}


/* =========================================================
 CUSTOM DATE / TIME PICKERS (replace the native inputs)
========================================================= */

(function () {

  function select(box, button) {
      [].forEach.call(box.children, item => {
          item.classList.toggle("selected", item === button);
          item.setAttribute("aria-checked", item === button);
      });
      document.getElementById("err2").innerText = "";
  }

  function init() {
      const days = document.getElementById("dayPicker");
      const times = document.getElementById("timePicker");
      if (!days || !times) return;

      const full = new Intl.DateTimeFormat("fa-IR", { weekday: "long", day: "numeric", month: "long" });
      const part = (date, options) => new Intl.DateTimeFormat("fa-IR", options).format(date);

      for (let i = 1; i <= 14; i++) {
          const date = new Date();
          date.setDate(date.getDate() + i);
          const iso = date.getFullYear() + "-" + ("0" + (date.getMonth() + 1)).slice(-2) + "-" + ("0" + date.getDate()).slice(-2);

          const button = document.createElement("button");
          button.type = "button";
          button.className = "v-day";
          button.setAttribute("role", "radio");
          button.setAttribute("aria-checked", "false");
          button.innerHTML = "<small></small><b></b><small></small>";
          button.children[0].textContent = part(date, { weekday: "short" });
          button.children[1].textContent = part(date, { day: "numeric" });
          button.children[2].textContent = part(date, { month: "short" });
          button.onclick = () => { select(days, button); booking.preferredDate = iso; booking.dateLabel = full.format(date); };
          days.appendChild(button);
      }

      for (let hour = 8; hour <= 20; hour++) {
          const value = ("0" + hour).slice(-2) + ":00";
          const button = document.createElement("button");
          button.type = "button";
          button.className = "v-time";
          button.setAttribute("role", "radio");
          button.setAttribute("aria-checked", "false");
          button.textContent = faDigits(value);
          button.onclick = () => { select(times, button); booking.preferredTime = value; };
          times.appendChild(button);
      }
  }

  document.addEventListener("DOMContentLoaded", init);

})();


/* =========================================================
 THREE.JS HERO — METALLIC SHAFT
 Runs only on pages that contain the canvas.
========================================================= */

(function () {

  const canvas =
      document.getElementById("elevator3D");

  if (!canvas || typeof THREE === "undefined") {
      return;
  }


  /* -----------------------------------------------------
     SCENE
  ----------------------------------------------------- */

  const scene = new THREE.Scene();


  /* -----------------------------------------------------
     CAMERA
  ----------------------------------------------------- */

  const camera =
      new THREE.PerspectiveCamera(
          75,
          window.innerWidth / window.innerHeight,
          0.1,
          1000
      );

  camera.position.z = 14;


  /* -----------------------------------------------------
     RENDERER
  ----------------------------------------------------- */

  const renderer =
      new THREE.WebGLRenderer({
          canvas: canvas,
          alpha: true
      });

  renderer.setSize(
      window.innerWidth,
      window.innerHeight
  );


  /* -----------------------------------------------------
     ELEVATOR SHAFT
  ----------------------------------------------------- */

  const shaft =
      new THREE.Mesh(
          new THREE.BoxGeometry(
              4,
              12,
              4
          ),

          new THREE.MeshStandardMaterial({
              color: 0x222a3a,
              metalness: 0.9,
              roughness: 0.2,
              transparent: true,
              opacity: 0.25
          })
      );

  scene.add(shaft);


  /* -----------------------------------------------------
     ELEVATOR CABIN
  ----------------------------------------------------- */

  const cabin =
      new THREE.Mesh(
          new THREE.BoxGeometry(
              2.5,
              2.5,
              2.5
          ),

          new THREE.MeshStandardMaterial({
              color: 0xD4AF37,
              metalness: 1,
              roughness: 0.15
          })
      );

  scene.add(cabin);


  /* -----------------------------------------------------
     LIGHTS
  ----------------------------------------------------- */

  const blueLight =
      new THREE.PointLight(
          0x1E90FF,
          2,
          30
      );

  blueLight.position.set(
      5,
      5,
      5
  );

  scene.add(blueLight);


  const goldLight =
      new THREE.PointLight(
          0xD4AF37,
          2,
          30
      );

  goldLight.position.set(
      -5,
      -5,
      5
  );

  scene.add(goldLight);


  /* -----------------------------------------------------
     ANIMATION
  ----------------------------------------------------- */

  let time = 0;

  function animate() {

      requestAnimationFrame(animate);

      time += 0.015;

      cabin.position.y =
          Math.sin(time) * 4;

      shaft.rotation.y += 0.002;

      cabin.rotation.y += 0.005;

      renderer.render(
          scene,
          camera
      );
  }

  animate();

})();


/* =========================================================
 REVEAL ON SCROLL + ANIMATED COUNTERS
========================================================= */

(function () {

  if (!("IntersectionObserver" in window)) {
      return;
  }


  /* =====================================================
     SCROLL REVEAL
  ===================================================== */

  const revealTargets =
      document.querySelectorAll(
          "h2, .card, .glass, .t-step, .proj-card, .info-card, .page-hero"
      );


  const revealObserver =
      new IntersectionObserver(
          function (entries) {

              entries.forEach(entry => {

                  if (!entry.isIntersecting) {
                      return;
                  }


                  const element =
                      entry.target;


                  revealObserver.unobserve(
                      element
                  );


                  element.classList.add(
                      "in"
                  );


                  /*
                   * After the animation finishes,
                   * restore the original hover/transition state.
                   */

                  setTimeout(() => {

                      element.classList.remove(
                          "reveal",
                          "in"
                      );

                      element.style.transitionDelay =
                          "";

                  }, 900);

              });

          },
          {
              threshold: 0.15
          }
      );


  /* -----------------------------------------------------
     OBSERVE REVEAL ELEMENTS
  ----------------------------------------------------- */

  revealTargets.forEach(
      (element, index) => {

          element.classList.add(
              "reveal"
          );

          element.style.transitionDelay =
              `${(index % 4) * 80}ms`;

          revealObserver.observe(
              element
          );

      }
  );


  /* =====================================================
     ANIMATED COUNTERS
  ===================================================== */

  const counterObserver =
      new IntersectionObserver(
          function (entries) {

              entries.forEach(entry => {

                  if (!entry.isIntersecting) {
                      return;
                  }


                  const element =
                      entry.target;


                  counterObserver.unobserve(
                      element
                  );


                  const end =
                      Number(element.dataset.count);

                  const suffix =
                      element.dataset.suffix || "";

                  const startTime =
                      performance.now();


                  function animateCounter(now) {

                      const progress =
                          Math.min(
                              (now - startTime) / 1500,
                              1
                          );


                      const easedProgress =
                          1 -
                          Math.pow(
                              1 - progress,
                              3
                          );


                      element.textContent =
                          Math.round(
                              end * easedProgress
                          ) + suffix;


                      if (progress < 1) {
                          requestAnimationFrame(
                              animateCounter
                          );
                      }
                  }


                  requestAnimationFrame(
                      animateCounter
                  );

              });

          },
          {
              threshold: 0.6
          }
      );


  /* -----------------------------------------------------
     OBSERVE COUNTERS
  ----------------------------------------------------- */

  document
      .querySelectorAll("[data-count]")
      .forEach(element => {
          counterObserver.observe(element);
      });

})();