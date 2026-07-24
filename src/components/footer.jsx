import React from "react";

const Footer = () => {
    const currentYear = new Date().getFullYear();

    return (
        <footer className="flex h-fit w-full flex-col items-center gap-5 py-7 dark:text-neutral-300 px-14 ">

            <p className="md:hidden">You can generate link with type <b>https://yourlink.com</b> on value QRCode</p>
            <span className="font-medium text-neutral-600 dark:text-neutral-400 text-center">
                &copy; {currentYear} Made by Taufiiqul Hakim{" "}
                (alias FIQTOR) | All
                rights reserved.
            </span>
        </footer>
    )
};

export default Footer;
