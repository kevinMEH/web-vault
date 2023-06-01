import Image from "next/image";
import Logo from "../public/logos/logo-text.svg";

import Triangle from "../components/Triangle";

import Picture from "../images/picture.jpeg";

type HeaderParameters = {
    vaultName: string;
}

const Header = ({ vaultName }: HeaderParameters) => {
    // TODO: getServerSideProps get vault image
    // TODO: Search bar implementation
    // TODO: Make search icon
    return <header className="flex h-14 bg-white border-b border-gray justify-between flex-shrink-0">
        <div className="flex items-center justify-center w-[300px]">
            <Image src={Logo} alt="Logo with text" height={30} priority={true} />
        </div>
        <div className="flex items-center">
            <div className="w-72 h-9 border border-gray rounded-full mr-6"></div>
            <div className="flex items-center justify-center space-x-3 w-[300px]">
                <Image src={Picture} alt={vaultName + " vault picture"} className="rounded-full w-9 h-9 object-cover" />
                <div className="font-title text-lg font-semibold text-sub mb-0.5">{vaultName}</div>
                <Triangle transparentX={true} borderSizes="border-x-[6px] border-t-[6px]" className="border-t-sub mt-1" />
                <div className="pr-1"></div>
            </div>
        </div>
    </header>
}

export default Header;