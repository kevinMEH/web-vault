import Image from "next/image";
import Logo from "../public/logos/logo-text.svg";

import Triangle from "../components/Triangle";

import Picture from "../images/picture.jpeg";
import SearchSVG from "../components/SVGS/SearchSVG";

type HeaderParameters = {
    vaultName: string;
}

const Header = ({ vaultName }: HeaderParameters) => {
    // TODO: getServerSideProps get vault image
    // TODO: Search bar implementation
    // TODO: Make search icon
    return <header className="flex h-14 bg-white border-b border-gray justify-between flex-shrink-0 flex-grow-0 items-center">
        <div className="flex items-center justify-center w-[320px] flex-shrink-0">
            <Image src={Logo} alt="Logo with text" height={30} priority={true} />
        </div>
        <div className="w-full flex items-center justify-end">
            <div className="relative w-6 h-6 flex-shrink-0">
                <SearchSVG name="Search" strokeWidth={2} className="text-sub" />
            </div>
            <div className="font-inter text-quiet ml-5 mx-14 pt-[1px] text-ellipsis whitespace-nowrap">Search for items</div>
        </div>
        <div className="flex items-center justify-center space-x-3 w-[350px] shrink-0">
            <Image src={Picture} alt={vaultName + " vault picture"} className="rounded-full w-9 h-9 object-cover" />
            <div className="font-title text-lg font-semibold text-sub mb-0.5">{vaultName}</div>
            <Triangle transparentX={true} borderSizes="border-x-[6px] border-t-[6px]" className="border-t-sub mt-1" />
            <div className="pr-1"></div>
        </div>
    </header>
}

export default Header;