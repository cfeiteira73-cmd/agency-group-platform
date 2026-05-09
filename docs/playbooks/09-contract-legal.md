# SOP 09 — Contract & Legal Workflow
**Owner:** Agent (coordination) + Advogado Parceiro | **AMI:** 22506

## Legal Document Checklist by Phase

### Pre-CPCV (Contract to Purchase)
Required documents from BUYER:
- [ ] NIF (Número de Identificação Fiscal)
- [ ] BI/Passaporte válido
- [ ] Comprovativo de morada (<3 months)
- [ ] Proof of funds / extrato bancário ou carta de aprovação bancária
- [ ] IBAN for transfer
- [ ] If company: certidão permanente + estatutos + poderes do representante

Required documents from SELLER:
- [ ] Certidão de teor (Conservatória do Registo Predial)
- [ ] Caderneta predial (finanças)
- [ ] Licença de habitabilidade
- [ ] Certificado energético (obrigatório por lei)
- [ ] Declaração de não-dívidas de condomínio
- [ ] IMI: confirmação de pagamento
- [ ] If mortgaged: declaração de capital em dívida

### CPCV Execution
**SLA:** Notarize within 5 business days of signed offer

Steps:
1. Advogado drafts CPCV (Agency Group template + customizations)
2. Both parties review (48h review window)
3. Carlos reviews deal economics (fee, split, timeline)
4. Notarization / assinatura (presencial ou por procuração)
5. Buyer pays CPCV deposit (typically 10–20%)
6. Record in CRM: `cpcv_date`, `fase` = 'CPCV'
7. Fire learning event: `cpcv_signed`
8. Notify all parties + schedule escritura date

### Escritura (Final Deed)
**SLA:** Typically 30–90 days after CPCV

Pre-escritura checklist (5 business days before):
- [ ] All seller documents verified and current
- [ ] Buyer financing confirmed / final bank approval
- [ ] IMT (Imposto Municipal sobre Transmissões) calculated
- [ ] IS (Imposto de Selo) calculated
- [ ] Notário confirmed and briefed
- [ ] Agency fee invoice prepared
- [ ] Wire transfer details confirmed

Day of Escritura:
1. Confirm all parties present (or procuração in order)
2. Verify all documents at notário
3. Confirm wire transfer received
4. Sign escritura
5. Collect commission (50% balance)
6. Update CRM: `fase` = 'Escritura', status = 'won'
7. Issue NPS survey to client (trigger: `post_escritura`)
8. Log in win_loss_events

## Tax Reference Guide

### Buyer Tax Obligations
**IMT (Imposto Municipal sobre Transmissões):**
- Primary residence: progressive rates (0% to 7.5% depending on value)
- Secondary/investment: flat 6% for urban properties
- Non-residents: standard rates apply

**IS (Imposto de Selo):**
- 0.8% of purchase price
- Additional 0.5% on mortgage amount (if applicable)

**Notário + Registo fees:** approximately €1.500–€3.000

### Seller Tax Obligations
**Mais-Valias (Capital Gains):**
- Residents: 50% of gain added to IRS income
- Non-residents: 28% flat rate on full gain
- Reinvestment exemption: if selling primary residence and reinvesting in Portugal/EU
- Properties held >2 years: reduced coefficient applied

**Tip:** Always recommend buyer and seller consult their own accountant/advogado for definitive tax calculations. Agent role is to flag; not to advise on tax.

## Agency Fee Invoicing
- Commission: 5% of transaction price + 23% IVA
- Payment structure: 50% at CPCV signing + 50% at Escritura
- Invoice must reference: "Mediação imobiliária, AMI 22506"
- Invoice issued by Agency Group, Lda.

## Compliance — AMI 22506
All contracts must reference: "Mediação imobiliária exercida por Agency Group, Lda., AMI n.º 22506"
GDPR: All client data processed under legitimate interest + consent documented in CRM.
RGPD: Retenção de dados: 7 anos para documentos financeiros, 3 anos para leads não convertidos.

## Common Legal Issues & Resolution

| Issue | Resolution | Escalation |
|---|---|---|
| Missing certidão | Order from Predial Permanente (24h online) | None |
| Missing energy cert | Refer to certified technician (3–5 days) | None |
| Mortgage outstanding | Seller bank payoff letter needed | Advogado if complex |
| Heir conflict | All heirs must sign or appoint procurador | Advogado + Carlos |
| Company purchase | Full KYC + AML documentation required | Advogado |
| Foreign buyer no NIF | Arrange NIF at Finanças or online | 1 week min buffer |
| Title defect | Halt transaction → Advogado immediately | Carlos + Advogado P1 |
| CPCV default by buyer | Penalty: forfeit deposit | Advogado formal notice |
| CPCV default by seller | Penalty: return deposit × 2 | Advogado + Carlos P0 |
