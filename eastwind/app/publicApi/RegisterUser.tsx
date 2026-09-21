import * as React from "react";
import { useParams, Link } from "react-router";
import * as AppContext from "@altea/altea/client/AppContext";
import { TypeContext, type EntityFrame } from "@altea/altea/client/TypeContext";
import { TextBoxLine } from "@altea/altea/client/Lines/TextBoxLine";
import { EnumLine } from "@altea/altea/client/Lines/EnumLine";
import { FormGroup } from "@altea/altea/client/Lines/FormGroup";
import { FormControlReadonly } from "@altea/altea/client/Lines/FormControlReadonly";
import { ValidationErrors } from "@altea/altea/client/Frames/ValidationErrors";
import { useAPI, useForceUpdate } from "@altea/altea/client/Hooks";
import { ValidationError } from "@altea/altea/client/Services";
import { GraphExplorer } from "@altea/altea/client/Reflection";
import { JavascriptMessage } from "@altea/altea/data/uiMessages";
import { ifError } from "@altea/altea/data/globals/helpers";
import { DoublePassword } from "@altea/altea-auth/client/Templates/DoublePassword";
import { RegisterUserModel, RegisterUserMessage } from "./RegisterUser.data";
import { PublicClient } from "./PublicClient.client";
import Address from "../customers/Address";

// The ANONYMOUS self-service registration page. The route
// is pushed by PublicClient.startPublic (from MainPublic, before the `isFull` branch), so it exists for a
// visitor who has never logged in; both endpoints behind it are `allowAnonymous` (PublicLogic.server.ts).
//
// altea divergences:
//  - `AutoLine` → `TextBoxLine` throughout: the lines here
//    are all plain strings and naming the editor skips the dispatch entirely.
//  - upstream leaves `onSubmit` commented out and the Register button a plain <button> inside a
//    <form>, i.e. it submits AND handles — a double action. Here the button is `type="submit"` and the FORM
//    is what registers, so Enter in any field works as it looks like it should.
export default function RegisterUser(): React.JSX.Element {
    const params = useParams() as { reportsToEmployeeId?: string };

    AppContext.useTitle(RegisterUserModel.niceName());

    return (
        <div id="hero" style={{ background: "url(" + AppContext.toAbsoluteUrl("/background_dark.jpg") + ")", backgroundSize: "cover" }}>
            <div style={{ margin: "0 auto", maxWidth: "680px", marginTop: "100px" }}>
                <div className="card shadow">
                    <RegisterUserCard reportsToEmployeeId={params.reportsToEmployeeId} />
                </div>
            </div>
        </div>
    );
}

function RegisterUserCard(p: { reportsToEmployeeId: string | undefined }): React.JSX.Element {
    const registerUser = useAPI(() => PublicClient.API.getRegisterUser(p.reportsToEmployeeId), [p.reportsToEmployeeId]);

    const forceUpdate = useForceUpdate();
    const [success, setSuccess] = React.useState(false);

    if (registerUser == null) {
        return (
            <div className="card-body">
                <h2 className="card-title">{JavascriptMessage.loading.niceToString()}</h2>
            </div>
        );
    }

    if (success) {
        return (
            <div className="card-body">
                <h2 className="card-title">{RegisterUserMessage.userRegistered.niceToString()}</h2>
                <p className="card-text">
                    {RegisterUserMessage.user0HasBeenRegisteredSuccessfully.niceToString().formatHtml(<strong>{registerUser.eMail}</strong>)}
                </p>
                <p className="card-text">
                    <Link to={AppContext.toAbsoluteUrl("/auth/login")}>{RegisterUserMessage.goToLoginPage.niceToString()}</Link>
                </p>
            </div>
        );
    }

    function handleRegister(e: React.FormEvent): void {
        e.preventDefault();
        void PublicClient.API.registerUser(registerUser!)
            .then(() => setSuccess(true))
            .catch(ifError(ValidationError, ve => {
                if (ve.modelState) {
                    GraphExplorer.setModelState(registerUser!, ve.modelState, "");
                    forceUpdate();
                }
            }));
    }

    // A hand-made frame: the page is not an entity frame (there is no EntityPack and nothing to save), and
    // `revalidate` is all the Lines need — it is what re-runs the live validation after a change.
    const ctx = TypeContext.root(registerUser, {
        formGroupStyle: "FloatingLabel",
        frame: { revalidate: forceUpdate } as EntityFrame,
    });

    return (
        <div className="card-body">
            <h2 className="card-title">{RegisterUserModel.niceName()}</h2>
            <p className="card-text">
                {RegisterUserMessage.pleaseFillTheFollowingFormToRegisterANewEastwindEmployee.niceToString()}
            </p>
            <form onSubmit={handleRegister}>
                {ctx.value.reportsTo && <FormGroup ctx={ctx.subCtx(r => r.reportsTo)}>
                    {id => <FormControlReadonly id={id} ctx={ctx.subCtx(r => r.reportsTo)}>
                        {ctx.value.reportsTo!.toString()}
                    </FormControlReadonly>}
                </FormGroup>}
                <div className="row">
                    <div className="col-sm-4">
                        <EnumLine ctx={ctx.subCtx(r => r.titleOfCourtesy)} optionItems={["Mr.", "Ms."]} />
                    </div>
                    <div className="col-sm-4">
                        <TextBoxLine ctx={ctx.subCtx(r => r.firstName)} />
                    </div>
                    <div className="col-sm-4">
                        <TextBoxLine ctx={ctx.subCtx(r => r.lastName)} />
                    </div>
                </div>
                <Address ctx={ctx.subCtx(a => a.address)} inheritStyle />
                <TextBoxLine ctx={ctx.subCtx(r => r.eMail)} />
                <TextBoxLine ctx={ctx.subCtx(r => r.username)} />
                <DoublePassword ctx={ctx.subCtx(r => r.password)} initialOpen mandatory />
                <ValidationErrors entity={ctx.value} prefix="" />
                <div className="mt-4 d-flex">
                    <button type="submit" className="ms-auto btn btn-primary px-4">
                        {RegisterUserMessage.register.niceToString()}
                    </button>
                </div>
            </form>
        </div>
    );
}
