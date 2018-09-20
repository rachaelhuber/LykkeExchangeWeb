import * as classnames from 'classnames';
import {Field, FieldProps, Form, Formik, FormikProps} from 'formik';
import {computed} from 'mobx';
import {inject, observer} from 'mobx-react';
import * as React from 'react';
import {Link, RouteComponentProps} from 'react-router-dom';
import Yup from 'yup';
import {RootStoreProps} from '../../App';
import {AmountInput} from '../../components/AmountInput';
import {Banner} from '../../components/Banner';
import {
  ROUTE_CONFIRM_OPERATION_ID,
  ROUTE_SECURITY
} from '../../constants/routes';
import {STORE_ROOT} from '../../constants/stores';
import {BalanceModel, WithdrawCryptoModel} from '../../models';
import {moneyRound} from '../../utils';

import './style.css';

interface WithdrawCryptoPageProps
  extends RootStoreProps,
    RouteComponentProps<any> {}

export class WithdrawCryptoPage extends React.Component<
  WithdrawCryptoPageProps
> {
  readonly assetStore = this.props.rootStore!.assetStore;
  readonly withdrawStore = this.props.rootStore!.withdrawStore;
  readonly walletStore = this.props.rootStore!.walletStore;
  readonly profileStore = this.props.rootStore!.profileStore;

  @computed
  get balance() {
    const {assetId} = this.props.match.params;

    if (this.walletStore.tradingWallets.length) {
      const balance = this.walletStore.tradingWallets[0].balances.find(
        (assetBalance: BalanceModel) => {
          return assetBalance.assetId === assetId;
        }
      );

      if (balance) {
        return balance.balance;
      }
    }

    return 0;
  }

  componentDidMount() {
    const {assetId} = this.props.match.params;
    this.withdrawStore.fetchFee(assetId);
    this.withdrawStore.fetchWithdrawCryptoInfo(assetId);
    this.withdrawStore.withdrawCrypto.balance = 300;

    window.scrollTo(0, 0);
  }

  render() {
    const {assetId} = this.props.match.params;
    const asset = this.assetStore.getById(assetId);
    const onSubmitSuccess = (operationId: string) => {
      this.props.history.replace(ROUTE_CONFIRM_OPERATION_ID(operationId));
    };
    const sendWithdrawCryptoRequest = this.withdrawStore
      .sendWithdrawCryptoRequest;
    const validateWithdrawCryptoRequest = this.withdrawStore
      .validateWithdrawCryptoRequest;
    const requiredErrorMessage = (fieldName: string) =>
      `Field ${fieldName} should not be empty`;

    return (
      <div>
        <div className="container">
          <div className="withdraw-crypto">
            <Banner
              show={!this.profileStore.is2faEnabled}
              className="tfa-banner"
              title="Two-Factor Authentication"
              text={
                <span>
                  To ensure the security of withdrawals from Lykke, you need to
                  turn on Two-Factor Authentication. Find out more about it{' '}
                  <Link to={ROUTE_SECURITY}>here</Link>.
                </span>
              }
            />
            <div className="withdraw-crypto__title">Withdraw</div>
            <div className="withdraw-crypto__subtitle">
              {this.balance} {!!asset && asset!.name}
            </div>
            <div className="withdraw-crypto__description">
              Your wallet will not be charged until you authorize this
              transaction. Please ensure that the withdrawal address is a valid{' '}
              {asset && asset.name} address. Transfer to another blockchain will
              result in funds loss.
            </div>
            <Formik
              initialValues={this.withdrawStore.withdrawCrypto}
              enableReinitialize
              validationSchema={Yup.object().shape({
                addressExtension: this.withdrawStore.isAddressExtensionMandatory
                  ? Yup.string().required(
                      requiredErrorMessage(
                        this.withdrawStore.addressExtensionTitle
                      )
                    )
                  : Yup.string(),
                amount: Yup.number()
                  .moreThan(0, requiredErrorMessage('Amount'))
                  .required(requiredErrorMessage('Amount')),
                baseAddress: Yup.string().required(
                  requiredErrorMessage(this.withdrawStore.baseAddressTitle)
                )
              })}
              // tslint:disable-next-line:jsx-no-lambda
              onSubmit={async (
                values: WithdrawCryptoModel,
                {setFieldError, setSubmitting}
              ) => {
                const feeSize = moneyRound(
                  this.withdrawStore.absoluteFee ||
                    this.withdrawStore.relativeFee ||
                    this.withdrawStore.absoluteFee * values.amount,
                  asset && asset.accuracy
                );
                const totalAmount = moneyRound(
                  Number(values.amount) + feeSize,
                  asset && asset.accuracy
                );

                if (totalAmount > this.balance) {
                  setFieldError(
                    'amount',
                    'Requested amount is more than balance'
                  );
                  setSubmitting(false);
                  return;
                }

                const isValid = await validateWithdrawCryptoRequest(
                  assetId,
                  values
                );

                if (isValid) {
                  const operationId = await sendWithdrawCryptoRequest(
                    assetId,
                    values
                  );
                  setSubmitting(false);
                  onSubmitSuccess(operationId);
                } else {
                  setFieldError('baseAddress', 'Address is not valid');
                  setSubmitting(false);
                }
              }}
              render={this.renderForm}
            />
          </div>
        </div>
      </div>
    );
  }

  private renderForm = (formikBag: FormikProps<WithdrawCryptoModel>) => {
    const {assetId} = this.props.match.params;
    const asset = this.assetStore.getById(assetId);
    const feeSize = moneyRound(
      this.withdrawStore.absoluteFee ||
        this.withdrawStore.relativeFee ||
        this.withdrawStore.absoluteFee * formikBag.values.amount,
      asset && asset.accuracy
    );
    const totalAmount = moneyRound(
      Number(formikBag.values.amount) + feeSize,
      asset && asset.accuracy
    );

    return (
      <Form className="withdraw-crypto-form">
        <div className="separator" />
        <Field
          name="amount"
          // tslint:disable-next-line:jsx-no-lambda
          render={({field, form}: FieldProps<WithdrawCryptoPageProps>) => (
            <div
              className={classnames('form-group inline-form', {
                'has-error': form.errors[field.name]
              })}
            >
              <div className="row row_amount">
                <div className="col-sm-4">
                  <label htmlFor={field.name} className="control-label">
                    Amount
                  </label>
                </div>
                <div className="col-sm-8">
                  <div className="input-group">
                    <div className="input-group-addon addon-text">
                      {asset && asset.name}
                    </div>
                    <div className="error-bar" />
                    <div className="amount-input">
                      <AmountInput
                        onChange={field.onChange}
                        value={field.value || ''}
                        name={field.name}
                        decimalLimit={asset && asset.accuracy}
                      />
                      {form.errors[field.name] && (
                        <span className="help-block">
                          {form.errors[field.name]}
                        </span>
                      )}
                    </div>
                    {field.value > 0 && (
                      <div>
                        <div className="fee-info">
                          <span className="fee-info__label">Fee:</span>
                          <span className="fee-info__value">
                            {feeSize} {asset && asset.name}
                          </span>
                        </div>
                        <div className="fee-info">
                          <span className="fee-info__label">Total:</span>
                          <span className="fee-info__value">
                            {totalAmount} {asset && asset.name}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        />

        {this.renderField('baseAddress', this.withdrawStore.baseAddressTitle)}
        {this.withdrawStore.isAddressExtensionMandatory &&
          this.renderField(
            'addressExtension',
            this.withdrawStore.addressExtensionTitle
          )}

        <hr />

        <div className="withdraw-crypto-form__actions">
          <input
            type="submit"
            value="Submit"
            className="btn btn--primary"
            disabled={
              formikBag.isSubmitting ||
              !formikBag.isValid ||
              !this.profileStore.is2faEnabled
            }
          />
          <a
            href="#"
            onClick={this.props.history.goBack}
            className="btn btn--flat"
          >
            Cancel and go back
          </a>
        </div>
      </Form>
    );
  };

  private renderField = (name: string, label: string) => (
    <Field
      name={name}
      // tslint:disable-next-line:jsx-no-lambda
      render={({field, form}: FieldProps<WithdrawCryptoModel>) => (
        <div
          className={classnames('form-group inline-form', {
            'has-error': form.errors[field.name] && form.touched[field.name]
          })}
        >
          <div className="row field-row">
            <div className="col-sm-4">
              <label htmlFor={name} className="control-label">
                {label}
              </label>
            </div>
            <div className="col-sm-8">
              <div className="error-bar" />
              <input
                id={field.name}
                type="text"
                {...field}
                className="form-control"
              />
              {form.errors[field.name] &&
                form.touched[field.name] && (
                  <span className="help-block">{form.errors[field.name]}</span>
                )}
            </div>
          </div>
        </div>
      )}
    />
  );
}

export default inject(STORE_ROOT)(observer(WithdrawCryptoPage));
