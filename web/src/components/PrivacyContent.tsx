import { useState, useEffect } from 'react';
import { ArrowLeft, ArrowUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link, useSearchParams } from 'react-router-dom';

const PrivacyContent = () => {
  const [showScrollTop, setShowScrollTop] = useState(false);

  // FMD Android shows the "/privacy?embedded=true" page as part of the registration flow
  const [searchParams] = useSearchParams();
  const isEmbedded = searchParams.get('embedded') === 'true';

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 300);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="privacy-page">
      <div className="privacy-page-inner">
        <div className="privacy-content-shell">
          {!isEmbedded && (
            <Link to="/" className="privacy-back">
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back</span>
            </Link>
          )}

          <div className="privacy-title-block">
            <h1 className="mb-2 text-4xl font-bold text-gray-900 dark:text-white">FMD Server</h1>
            <h2 className="text-fmd-green text-2xl font-semibold">Privacy Notice</h2>
          </div>

          <nav className="privacy-nav">
            <h3 className="privacy-nav-heading">Quick Navigation</h3>
            <ul className="privacy-nav-list">
              <li>
                <a href="#visiting" className="privacy-inline-link">
                  What data is stored when visiting the website?
                </a>
              </li>
              <li>
                <a href="#stored" className="privacy-inline-link">
                  What data is stored on the server?
                </a>
              </li>
              <li>
                <a href="#encryption" className="privacy-inline-link">
                  How exactly does the encryption work?
                </a>
              </li>
              <li>
                <a href="#transferred" className="privacy-inline-link">
                  Is my data transferred/sold/etc?
                </a>
              </li>
              <li>
                <a href="#access" className="privacy-inline-link">
                  Who has access to the data?
                </a>
              </li>
              <li>
                <a href="#delete" className="privacy-inline-link">
                  How can I delete my data from the server?
                </a>
              </li>
              <li>
                <a href="#export" className="privacy-inline-link">
                  How can I export my data?
                </a>
              </li>
              <li>
                <a href="#change-password" className="privacy-inline-link">
                  How can I change my password?
                </a>
              </li>
              <li>
                <a href="#reset-password" className="privacy-inline-link">
                  How can I reset my password?
                </a>
              </li>
            </ul>
          </nav>

          <div className="privacy-sections">
            <section id="visiting">
              <h3 className="privacy-section-heading">
                What data is stored when visiting the website?
              </h3>
              <p className="privacy-section-copy">
                To establish a connection, your IP address is transmitted. To prevent abuse, the IP
                address is logged for failed login attempts.
              </p>
            </section>

            <section id="stored">
              <h3 className="privacy-section-heading">What data is stored on the server?</h3>

              <div className="space-y-4">
                <div>
                  <p className="mb-2 font-medium text-gray-900 dark:text-white">In plaintext:</p>
                  <ul className="privacy-data-list">
                    <li>Username</li>
                    <li>Password Hash</li>
                    <li>Public key</li>
                    <li>Push URL</li>
                    <li>Unix timestamp when the client last connected</li>
                  </ul>
                </div>

                <div>
                  <p className="mb-2 font-medium text-gray-900 dark:text-white">Signed:</p>
                  <ul className="privacy-data-list">
                    <li>Command to be delivered to the phone</li>
                  </ul>
                </div>

                <div>
                  <p className="mb-2 font-medium text-gray-900 dark:text-white">Encrypted:</p>
                  <ul className="privacy-data-list">
                    <li>Private key</li>
                    <li>If uploaded: pictures</li>
                    <li>If uploaded: locations (lat, lon, battery level, timestamp, etc.)</li>
                  </ul>
                </div>

                <p className="privacy-warning">
                  <strong className="text-gray-900 dark:text-white">Important:</strong> You need to
                  keep your password safe! Your password is used to unlock the encrypted private
                  key.
                </p>
              </div>
            </section>

            <section id="encryption">
              <h3 className="privacy-section-heading">How exactly does the encryption work?</h3>
              <p className="privacy-section-copy">
                Please see the description on the{' '}
                <a
                  href="https://fmd-foss.org/docs/fmd-server/security"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="privacy-inline-link"
                >
                  project website
                </a>
                .
              </p>
            </section>

            <section id="transferred">
              <h3 className="privacy-section-heading">Is my data transferred/sold/etc?</h3>
              <p className="privacy-section-copy">
                Your data is only used to provide the functionality of finding and controlling your
                device. It is not given to other parties.
              </p>
            </section>

            <section id="access">
              <h3 className="privacy-section-heading">Who has access to the data?</h3>
              <p className="privacy-section-copy">
                Only the server operator has access to the database. But all important data is
                encrypted anyway.
              </p>
            </section>

            <section id="delete">
              <h3 className="privacy-section-heading">How can I delete my data from the server?</h3>
              <p className="privacy-section-copy">
                You can delete your account using the &quot;Delete Account&quot; button in the web
                interface and in the Android app.
              </p>
            </section>

            <section id="export">
              <h3 className="privacy-section-heading">How can I export my data?</h3>
              <p className="privacy-section-copy">
                Log in via the web interface, click on the settings icon, and then click on
                &quot;Export Data&quot;. This will fetch all data from the server, decrypt it
                locally, and locally create a ZIP file that you can save to your computer.
              </p>
            </section>

            <section id="change-password">
              <h3 className="privacy-section-heading">How can I change my password?</h3>
              <p className="privacy-section-copy">
                You can change your password in the FMD Android app in the FMD Server settings
                section.
              </p>
            </section>

            <section id="reset-password">
              <h3 className="privacy-section-heading">How can I reset my password?</h3>
              <p className="privacy-section-copy">
                You cannot reset your password, only change it. The server administrator cannot
                reset or change your password. They can only delete your account entirely (allowing
                you to register again). However, since this is destructive, the server administrator
                should only do so if they can verify that this account really belongs to you.
              </p>
            </section>
          </div>
        </div>

        {showScrollTop && (
          <Button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            size="icon"
            className="fixed right-8 bottom-8 rounded-full shadow-lg"
            aria-label="Scroll to top"
          >
            <ArrowUp className="h-5 w-5" />
          </Button>
        )}
      </div>
    </div>
  );
};

export default PrivacyContent;
