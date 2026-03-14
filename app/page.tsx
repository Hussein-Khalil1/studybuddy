import Link from "next/link";

export default function Home() {
  return (
    <div className="landing-wrap">
      <main className="landing-card">
        <div className="landing-card-head">
          <h1>STUDYBUDDY</h1>
          <Link href="/auth">Login</Link>
        </div>

          <section className="hero">
            <h2>Welcome to STUDYBUDDY</h2>
            <div className="hero-actions">
              <Link href="/auth?tab=signup" className="hero-btn hero-btn-light">
                Sign Up
              </Link>
              <button type="button" className="hero-btn hero-btn-ghost">
                Learn More
              </button>
            </div>
            <div className="hero-panel" />
          </section>

          <section className="mission">
            <h3>Our Mission:</h3>
            <p>
              Get the support you need with STUDYBUDDY, The perfect app to
              excel at school!
            </p>
            <button type="button">Call to action</button>
          </section>

          <section className="media-grid" aria-label="Featured previews">
            <div className="media-box media-one" />
            <div className="media-box media-two" />
            <div className="media-box media-three" />
            <div className="media-box media-four" />
          </section>

          <section className="testimonials">
            <h3>Testimonials</h3>
            <p>A little line about what&apos;s being said and who&apos;s saying it.</p>
            <div className="testimonial-grid">
              <article className="quote-card">
                <div className="quote-head">
                  <span className="quote-dot quote-green" />
                  <div>
                    <strong>Carl Carterlyar</strong>
                    <small>Growth at Corocona &amp; Co.</small>
                  </div>
                </div>
                <p>
                  Using this product felt like it transformed me completely.
                </p>
              </article>
              <article className="quote-card">
                <div className="quote-head">
                  <span className="quote-dot quote-pink" />
                  <div>
                    <strong>Wanda Wrightton</strong>
                    <small>Lead compiler at Bufferly</small>
                  </div>
                </div>
                <p>
                  Your expectations will fly sky high. I felt like I was
                  soaring.
                </p>
              </article>
            </div>
          </section>

        <footer className="landing-footer">
          <div>
            <h4>Namedly</h4>
          </div>
          <div>
            <h5>Platform</h5>
            <a href="#">Individuals</a>
            <a href="#">Teams</a>
            <a href="#">Admins</a>
            <a href="#">Developers</a>
          </div>
          <div>
            <h5>Features</h5>
            <a href="#">Core features</a>
            <a href="#">Doc experience</a>
            <a href="#">Integrations</a>
          </div>
          <div>
            <h5>Learn more</h5>
            <a href="#">Blog</a>
            <a href="#">Case studies</a>
            <a href="#">Customer stories</a>
            <a href="#">Best practices</a>
          </div>
          <div>
            <h5>Support</h5>
            <a href="#">Contact</a>
            <a href="#">Support</a>
            <Link href="/auth">Login</Link>
          </div>
        </footer>
      </main>
    </div>
  );
}
