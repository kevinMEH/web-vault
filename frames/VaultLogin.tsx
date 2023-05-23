import Image, { StaticImageData } from "next/image";
import { useState } from "react";
import Button from "../components/Button";
import TextField from "../components/TextField";

type VaultLoginParameters = {
    title: string;
    description: string;
    image: StaticImageData;
    imageAlt: string;
    className?: string;
}

const VaultLogin = ({ title, description, image, imageAlt, className = "" }: VaultLoginParameters) => {
    const [vaultName, setVaultName] = useState("");
    const [password, setPassword] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(false);
    
    function onLogin() {
        // Check non empty values and regexes. Set error if necessary
        setSubmitting(true);
        // Send a request. Check response, set error if needed.
        // JWT Will be set by cookie. Redirect to main vault page
    }

    return <div className={"flex flex-col-reverse sm:flex-row bg-white border border-gray rounded-2xl sm:rounded-3xl overflow-clip " + className}>
        <div className="basis-[55%] pt-6 pb-10 sm:py-14 px-8 sm:px-12 space-y-3 sm:space-y-4">
            <h1 className="text-2xl sm:text-3xl md:text-4xl text-main font-title font-bold">{title}</h1>
            <p className="text-sm md:text-base font-inter text-sub">{description}</p>
            <TextField name="Vault Name" labelText="Vault Name" id="vault-field"
            placeholder="Vault Name" value={vaultName} setValue={setVaultName}
            type="text" error={error} disabled={submitting} required={true}
            className="pt-3.5 sm:max-w-xs !w-auto"
            />
            <TextField name="Password" labelText="Password" id="password-field"
            placeholder="Password" value={password} setValue={setPassword}
            type="password" error={error} disabled={submitting} required={true}
            className="pt-2 sm:max-w-xs !w-auto"
            />
            <Button wrapperClassName="pt-2" onClick={onLogin} disabled={submitting}
            className="text-sm font-inter font-medium text-main w-full sm:max-w-xs py-3
            bg-accent-light hover:bg-accent-dark
            disabled:bg-accent-extra-light disabled:text-main/50
            transition-colors"
            >Access Vault</Button>
        </div>
        <div className="basis-[45%] relative">
            <Image src={image} alt={imageAlt} priority={true} className="h-40 sm:absolute sm:h-full sm:w-full sm:inset-0 object-cover" />
        </div>
    </div>
}

export default VaultLogin;